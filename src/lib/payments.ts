import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shipments, users } from "@/db/schema";
import { notifyCustomerStatusChange } from "./email";
import { convertNgnTo } from "./pricing";
import { addTrackingEvent, generateTrackingNumber, getShipment, type Shipment } from "./shipments";

/**
 * Paystack + Stripe checkout, ported from WordPress inc/booking.php. Keys
 * live in Vercel environment variables (never in the database or the
 * backoffice). With neither configured, /pay runs in test mode.
 */
export const paystackReady = () => Boolean(process.env.PAYSTACK_SECRET_KEY);
export const stripeReady = () => Boolean(process.env.STRIPE_SECRET_KEY);

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export class PaymentError extends Error {}

async function contactEmail(s: Shipment) {
  if (s.customerId) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, s.customerId)).limit(1);
    if (u) return u.email;
  }
  return s.senderEmail ?? "";
}

/**
 * Currencies the Paystack account accepts. Nigerian accounts take only NGN
 * unless others are enabled by Paystack; list extras in PAYSTACK_CURRENCIES
 * (e.g. "NGN,USD") once they are.
 */
const paystackCurrencies = () => (process.env.PAYSTACK_CURRENCIES ?? "NGN").toUpperCase().split(",").map((c) => c.trim());

/**
 * What Paystack will charge: the customer's chosen currency when the account
 * supports it, otherwise naira (the booking's base price).
 */
export function paystackCharge(s: Shipment) {
  const chosen = (s.chargeCurrency || s.currency).toUpperCase();
  if (paystackCurrencies().includes(chosen) && s.chargeAmount != null) return { currency: chosen, amount: s.chargeAmount };
  return { currency: "NGN", amount: s.priceAmount };
}

/** What Stripe will charge: the chosen currency, or US dollars for a naira booking (Stripe doesn't take NGN). */
export async function stripeCharge(s: Shipment) {
  const chosen = (s.chargeCurrency ?? "").toUpperCase();
  if (chosen && chosen !== "NGN" && s.chargeAmount != null) return { currency: chosen, amount: s.chargeAmount };
  return { currency: "USD", amount: await convertNgnTo(s.priceAmount, "USD") };
}

/** Initializes a Paystack transaction and returns its hosted-checkout URL. */
export async function startPaystackCheckout(s: Shipment) {
  const { currency, amount } = paystackCharge(s);
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: await contactEmail(s),
      // Paystack expects the smallest currency unit (kobo for NGN, cents for USD).
      amount: Math.round(amount * 100),
      currency,
      callback_url: `${siteUrl()}/payment-callback?shipment_id=${s.id}`,
      metadata: { shipment_id: s.id },
    }),
  }).catch(() => null);
  if (!res) throw new PaymentError("Could not reach the payment gateway. Please try again.");
  const body = await res.json();
  if (!body?.status || !body?.data?.authorization_url) throw new PaymentError("Payment gateway error: " + (body?.message ?? "Unknown error"));
  return body.data.authorization_url as string;
}

/**
 * Creates a Stripe Checkout session. Stripe doesn't accept NGN for most
 * accounts, so an NGN booking is charged in USD at today's rate.
 */
export async function startStripeCheckout(s: Shipment) {
  const charge = await stripeCharge(s);
  const currency = charge.currency.toLowerCase();
  const amount = charge.amount;
  const params = new URLSearchParams({
    mode: "payment",
    "payment_method_types[]": "card",
    customer_email: await contactEmail(s),
    success_url: `${siteUrl()}/payment-callback?shipment_id=${s.id}&gateway=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pay?shipment_id=${s.id}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
    "line_items[0][price_data][product_data][name]": `Coastal Parcel Shipment #${s.id} (${s.pickupCity} → ${s.deliveryCity})`,
    "metadata[shipment_id]": String(s.id),
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  }).catch(() => null);
  if (!res) throw new PaymentError("Could not reach the payment gateway. Please try again.");
  const data = await res.json();
  if (!data?.url) throw new PaymentError("Payment gateway error: " + (data?.error?.message ?? "Unknown error"));
  return data.url as string;
}

export type Verified = { ok: true; currency: string; amount: number } | { ok: false; error: string };

/**
 * Server-side verification — payment success is never trusted from the
 * redirect alone. The transaction must also belong to this shipment, so a
 * reference from another (cheaper) payment can't be replayed here.
 */
export async function verifyPaystack(reference: string, shipmentId: number): Promise<Verified> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach Paystack to verify the payment." };
  const body = await res.json();
  const d = body?.data;
  if (d?.status !== "success") return { ok: false, error: body?.message ?? "Payment could not be verified." };
  if (Number(d.metadata?.shipment_id) !== shipmentId) return { ok: false, error: "This payment doesn't belong to this shipment." };
  return { ok: true, currency: String(d.currency).toUpperCase(), amount: Number(d.amount) / 100 };
}

export async function verifyStripe(sessionId: string, shipmentId: number): Promise<Verified> {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach Stripe to verify the payment." };
  const data = await res.json();
  if (data?.payment_status !== "paid") return { ok: false, error: data?.error?.message ?? "Payment could not be verified." };
  if (Number(data.metadata?.shipment_id) !== shipmentId) return { ok: false, error: "This payment doesn't belong to this shipment." };
  return { ok: true, currency: String(data.currency).toUpperCase(), amount: Number(data.amount_total) / 100 };
}

/**
 * Marks a shipment paid and assigns its tracking number. Only acts on a
 * shipment still awaiting payment, so a double callback (refresh, back
 * button) can't create a second tracking number or a duplicate event.
 */
export async function finalizePaidShipment(
  shipmentId: number,
  gateway: string,
  reference: string,
  note: string,
  actorId?: number | null,
  charged?: { currency: string; amount: number },
) {
  const trackingNumber = await generateTrackingNumber();
  const updated = await db
    .update(shipments)
    .set({
      status: "paid",
      paymentStatus: "paid",
      paymentGateway: gateway,
      paymentReference: reference,
      trackingNumber,
      // Record what the gateway actually charged (e.g. Paystack in NGN for a USD quote).
      ...(charged ? { chargeCurrency: charged.currency, chargeAmount: charged.amount } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(shipments.id, shipmentId), eq(shipments.status, "confirmed")))
    .returning({ id: shipments.id });
  if (!updated.length) return;
  await addTrackingEvent(shipmentId, "paid", note, actorId ?? null);
  const s = await getShipment(shipmentId);
  if (s) await notifyCustomerStatusChange(s, "paid");
}
