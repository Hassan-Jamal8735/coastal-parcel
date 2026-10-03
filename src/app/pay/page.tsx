import { redirect } from "next/navigation";
import { processPayment } from "@/app/actions/payment";
import { BookingLayout } from "@/components/booking-layout";
import { currencySymbol, formatMoney, serviceLabel } from "@/lib/constants";
import { paystackCharge, paystackReady, stripeCharge, stripeReady } from "@/lib/payments";
import { calculateFinalPrice, convertNgnTo, getPricingSettings } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";
import { PayForm } from "./pay-form";

export const metadata = { title: "Pay" };

export default async function PayPage({ searchParams }: { searchParams: Promise<{ shipment_id?: string }> }) {
  const { shipment_id } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status === "draft") redirect(`/booking?shipment_id=${s.id}`);
  if (s.status !== "confirmed") redirect(`/booking-confirmed?shipment_id=${s.id}`);

  const currency = s.chargeCurrency || "NGN";
  const rates = await getPricingSettings();
  const b = calculateFinalPrice(rates, { weightKg: s.packageWeight, distanceKm: s.distanceKm ?? 0, fulfillment: s.fulfillment, serviceType: s.serviceType, addons: s.addons });
  const sym = currencySymbol(currency);
  const show = async (ngn: number) => sym + (await convertNgnTo(ngn, currency)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paystack = paystackReady();
  const stripe = stripeReady();
  const live = paystack || stripe;
  // Shown under a gateway only when it charges a different currency than the total above.
  const chargeNote = (c: { currency: string; amount: number }) => (c.currency === currency ? null : `Charged as ${formatMoney(Math.round(c.amount * 100) / 100, c.currency)}`);
  const paystackNote = paystack ? chargeNote(paystackCharge(s)) : null;
  const stripeNote = stripe ? chargeNote(await stripeCharge(s)) : null;

  const rows: [string, string][] = [["Transportation Charges", await show(b.basePrice)]];
  if (Math.abs(b.serviceAdjustment) > 0.01) {
    rows.push([`${serviceLabel(s.serviceType)} Service Adjustment`, (b.serviceAdjustment < 0 ? "−" : "") + (await show(Math.abs(b.serviceAdjustment)))]);
  }
  for (const key of s.addons) if (rates.addons[key]) rows.push([rates.addons[key].label, await show(rates.addons[key].priceNgn)]);
  if (b.pickupFee > 0) rows.push(["Pickup Fee", await show(b.pickupFee)]);

  return (
    <BookingLayout active="shipments" minimalHeader>
      {!live && (
        <div className="auth-notice">
          Test Mode &mdash; no real payment gateway is connected yet. Clicking &quot;Pay Now&quot; simulates a successful payment so you can see the full workflow.
        </div>
      )}
      <h1 className="mb-20">Payment</h1>
      <p className="p-light">
        Shipment #{s.id} &middot; {s.pickupCity} &rarr; {s.deliveryCity}
      </p>

      <div className="pay-charges-card">
        <p className="pay-charges-title">{serviceLabel(s.serviceType)}</p>
        <table className="pay-charges-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
            <tr className="pay-charges-total">
              <td>Total</td>
              <td>{await show(b.finalPrice)}</td>
            </tr>
          </tbody>
        </table>
        {currency !== "NGN" && (
          <p className="p-light" style={{ marginTop: 8 }}>
            (&#8358;{Math.round(b.finalPrice).toLocaleString("en-US")} in Nigerian Naira, converted to {currency} at today&apos;s rate)
          </p>
        )}
      </div>

      {!live && (
        <>
          <div className="form-field">
            <div className="label">Card Number</div>
            <input className="field w-input" type="text" value="4242 4242 4242 4242" disabled />
          </div>
          <div className="form-row-2col">
            <div className="form-field">
              <div className="label">Expiry</div>
              <input className="field w-input" type="text" value="12/30" disabled />
            </div>
            <div className="form-field">
              <div className="label">CVC</div>
              <input className="field w-input" type="text" value="123" disabled />
            </div>
          </div>
        </>
      )}

      <PayForm action={processPayment.bind(null, s.id)} paystack={paystack} stripe={stripe} paystackNote={paystackNote} stripeNote={stripeNote} />
    </BookingLayout>
  );
}
