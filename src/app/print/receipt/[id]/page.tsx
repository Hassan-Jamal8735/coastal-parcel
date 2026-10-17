/* eslint-disable @next/next/no-img-element -- static logo, printed as-is */
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/print-toolbar";
import { db } from "@/db";
import { trackingEvents, users } from "@/db/schema";
import { formatMoney, packageTypeLabel, serviceLabel, SHIPMENT_PURPOSES, SITE_TIMEZONE, weightBoth } from "@/lib/constants";
import { barcodeSvg, canPrintShipment } from "@/lib/print";
import { getPricingSettings } from "@/lib/pricing";
import { getPackages, getShipment } from "@/lib/shipments";

export const metadata = { title: "Receipt" };

const GATEWAYS: Record<string, string> = { paystack: "Paystack", stripe: "Stripe (card)", test_mode: "Test payment", manual: "Manual" };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: SITE_TIMEZONE });
const naira = (n: number) => formatMoney(Math.round(n * 100) / 100, "NGN");

/** A4 payment receipt for a paid shipment. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShipment(Number(id));
  if (!s || !(await canPrintShipment(s))) notFound();

  const [packages, rates, [paid], customer] = await Promise.all([
    getPackages(s.id),
    getPricingSettings(s.pickupCountry),
    db.select({ at: trackingEvents.createdAt }).from(trackingEvents).where(and(eq(trackingEvents.shipmentId, s.id), eq(trackingEvents.status, "paid"))).orderBy(asc(trackingEvents.id)).limit(1),
    s.customerId ? db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, s.customerId)).limit(1).then((r) => r[0]) : null,
  ]);

  // The shipment stores its final price and add-on total; list each add-on by name.
  const addons = s.addons.map((key) => ({ label: rates.addons[key]?.label ?? key, price: rates.addons[key]?.priceNgn ?? 0 }));
  const addonsMatch = addons.reduce((n, a) => n + a.price, 0) === s.addonsTotalNgn;
  const shippingCharge = s.priceAmount - s.addonsTotalNgn - s.packageChargesNgn;
  const chargedOther = s.chargeCurrency && s.chargeCurrency !== "NGN" && s.chargeAmount != null;
  const receiptNo = `CP-R-${String(s.id).padStart(6, "0")}`;
  const billedTo = customer ?? { name: s.senderName, email: s.senderEmail ?? "" };

  return (
    <div className="doc-screen">
      {/* This document's paper size when printed. */}
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <PrintToolbar title={`Receipt ${receiptNo}`} hint="A4" />
      <section className="receipt-sheet">
        <header className="receipt-head">
          <div className="receipt-brand">
            <img src="/assets/img/email-logo.png" alt="Coastal Parcel" />
          </div>
          <div className="receipt-title">
            <h1>Receipt</h1>
            <p>{receiptNo}</p>
            <span className="receipt-paid">PAID</span>
          </div>
        </header>

        <div className="receipt-meta">
          <div>
            <p className="receipt-tag">Billed to</p>
            <p className="receipt-strong">{billedTo.name}</p>
            <p>{billedTo.email}</p>
            <p>{s.senderPhone}</p>
          </div>
          <div>
            <p className="receipt-tag">From</p>
            <p className="receipt-strong">Coastal Parcel</p>
            <p>3 Diffri Road Amikanle, Alagbado, Lagos, NG</p>
            <p>Info@coastalparcel.com · +234 707 583 6785</p>
          </div>
          <div>
            <p className="receipt-tag">Details</p>
            <p>Date paid: <strong>{day(paid?.at ?? s.updatedAt)}</strong></p>
            <p>Tracking: <strong>{s.trackingNumber}</strong></p>
            <p>Shipment: <strong>#{s.id}</strong></p>
          </div>
        </div>

        <div className="receipt-route">
          <div>
            <p className="receipt-tag">Pickup</p>
            <p className="receipt-strong">{s.senderName}</p>
            <p>{s.pickupAddress}, {s.pickupCity}{s.pickupPostalCode ? ` ${s.pickupPostalCode}` : ""}, {s.pickupCountry}</p>
          </div>
          <div className="receipt-arrow">&rarr;</div>
          <div>
            <p className="receipt-tag">Delivery</p>
            <p className="receipt-strong">{s.receiverName}</p>
            <p>{s.deliveryAddress}, {s.deliveryCity}{s.deliveryPostalCode ? ` ${s.deliveryPostalCode}` : ""}, {s.deliveryCountry}</p>
          </div>
        </div>

        <table className="receipt-table">
          <thead>
            <tr><th>Description</th><th>Qty</th><th className="num">Amount (NGN)</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>{serviceLabel(s.serviceType ?? "") || "Shipping"}</strong> shipping{s.fulfillment === "pickup" ? ", including pickup" : ""}
                <div className="receipt-sub">
                  {s.isDocument ? "Document" : "Package"} · {weightBoth(s.packageWeight)}
                  {s.distanceKm ? ` · ${Math.round(s.distanceKm).toLocaleString("en-US")} km` : ""}
                  {s.shipmentPurpose ? ` · ${SHIPMENT_PURPOSES[s.shipmentPurpose as keyof typeof SHIPMENT_PURPOSES] ?? s.shipmentPurpose}` : ""}
                </div>
                {packages.length > 1 && (
                  <div className="receipt-sub">
                    {packages.map((p) => `${p.pieces} × ${weightBoth(p.weight)}${p.description ? ` (${p.description})` : ""}`).join(" · ")}
                  </div>
                )}
              </td>
              <td>{s.packagePieces}</td>
              <td className="num">{naira(shippingCharge)}</td>
            </tr>
            {s.packageChargesNgn > 0 &&
              packages
                .filter((p) => p.packageType && rates.packageCharges[p.packageType])
                .map((p) => (
                  <tr key={`pkg-${p.id}`}>
                    <td>{packageTypeLabel(p.packageType)} handling</td>
                    <td>{p.pieces}</td>
                    <td className="num">{naira(rates.packageCharges[p.packageType!] * p.pieces)}</td>
                  </tr>
                ))}
            {addonsMatch
              ? addons.map((a) => (
                  <tr key={a.label}>
                    <td>{a.label}</td>
                    <td>1</td>
                    <td className="num">{naira(a.price)}</td>
                  </tr>
                ))
              : s.addonsTotalNgn > 0 && (
                  <tr>
                    <td>Optional services ({addons.map((a) => a.label).join(", ")})</td>
                    <td>1</td>
                    <td className="num">{naira(s.addonsTotalNgn)}</td>
                  </tr>
                )}
          </tbody>
          <tfoot>
            <tr className="receipt-total">
              <td colSpan={2}>Total</td>
              <td className="num">{naira(s.priceAmount)}</td>
            </tr>
            {chargedOther && (
              <tr>
                <td colSpan={2}>Amount charged ({s.chargeCurrency})</td>
                <td className="num">{formatMoney(s.chargeAmount!, s.chargeCurrency!)}</td>
              </tr>
            )}
          </tfoot>
        </table>

        <div className="receipt-payment">
          <p>
            Paid via <strong>{GATEWAYS[s.paymentGateway ?? ""] ?? s.paymentGateway ?? "—"}</strong>
            {s.paymentReference && (
              <>
                {" "}· Reference <code>{s.paymentReference}</code>
              </>
            )}
          </p>
        </div>

        <div className="receipt-foot">
          <div className="receipt-barcode">
            <div className="label-svg" dangerouslySetInnerHTML={{ __html: barcodeSvg(s.trackingNumber!) }} />
            <p>{s.trackingNumber}</p>
          </div>
          <p className="receipt-thanks">
            Thank you for shipping with Coastal Parcel. Track this shipment any time at coastalparcel.com/track-shipment.
            <br />
            The final charge may be adjusted after we reweigh and measure your parcel.
          </p>
        </div>
      </section>
    </div>
  );
}
