"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { finalizePaidShipment, PaymentError, paystackReady, startPaystackCheckout, startStripeCheckout, stripeReady } from "@/lib/payments";
import { canAccessShipment, getShipment } from "@/lib/shipments";

export type PayState = { error?: string } | undefined;

export async function processPayment(id: number, _: PayState, formData: FormData): Promise<PayState> {
  const s = await getShipment(id);
  if (!(await canAccessShipment(s))) redirect("/dashboard#shipments");
  // Also required client-side, but enforced here so a payment can't be pushed through with a hand-crafted request.
  if (!formData.get("terms_accepted")) return { error: "Please accept the Terms of Service before paying." };
  if (s!.status === "draft") redirect(`/booking?shipment_id=${id}`);
  if (s!.status !== "confirmed") redirect(`/booking-confirmed?shipment_id=${id}`);

  const paystack = paystackReady();
  const stripe = stripeReady();
  let checkoutUrl: string;
  try {
    if (paystack && stripe) {
      checkoutUrl = formData.get("gateway") === "stripe" ? await startStripeCheckout(s!) : await startPaystackCheckout(s!);
    } else if (paystack) {
      checkoutUrl = await startPaystackCheckout(s!);
    } else if (stripe) {
      checkoutUrl = await startStripeCheckout(s!);
    } else {
      // Test mode — no gateway keys configured yet.
      const reference = "TEST-" + Math.random().toString(36).slice(2, 14).toUpperCase();
      const user = await getCurrentUser();
      await finalizePaidShipment(id, "test_mode", reference, `Payment received (test mode). Reference: ${reference}`, user?.id);
      checkoutUrl = `/booking-confirmed?shipment_id=${id}`;
    }
  } catch (e) {
    if (e instanceof PaymentError) return { error: e.message };
    throw e;
  }
  redirect(checkoutUrl);
}
