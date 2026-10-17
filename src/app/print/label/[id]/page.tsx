/* eslint-disable @next/next/no-img-element -- static logo, printed as-is */
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/print-toolbar";
import { packageTypeLabel, serviceLabel, SITE_TIMEZONE, weightBoth } from "@/lib/constants";
import { siteUrl } from "@/lib/env";
import { barcodeSvg, canPrintShipment, qrSvg } from "@/lib/print";
import { getPackages, getShipment } from "@/lib/shipments";

export const metadata = { title: "Shipping label" };

/** 4×6 in shipping labels, one per parcel ("1 of N"), with the tracking barcode and a QR code to the tracking page. */
export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShipment(Number(id));
  if (!s || !(await canPrintShipment(s))) notFound();

  const tracking = s.trackingNumber!;
  const packages = await getPackages(s.id);
  // One label per physical parcel: a package row with 3 pieces prints 3 labels.
  const parcels = packages.flatMap((p) =>
    Array.from({ length: Math.max(1, p.pieces) }, () => ({ weight: p.weight, description: packageTypeLabel(p.packageType) ?? p.description })),
  );
  if (!parcels.length) parcels.push({ weight: s.packageWeight, description: null });
  const total = parcels.length;

  const barcode = barcodeSvg(tracking);
  const qr = qrSvg(`${siteUrl()}/track-shipment?tracking=${tracking}`);
  const shipDate = (s.shippingDate ? new Date(`${s.shippingDate}T12:00:00Z`) : s.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: SITE_TIMEZONE,
  });

  return (
    <div className="doc-screen">
      {/* This document's paper size when printed. */}
      <style>{`@page { size: 4in 6in; margin: 0; }`}</style>
      <PrintToolbar title={`Shipping label · ${tracking}`} hint={`${total} label${total === 1 ? "" : "s"} · 4×6 in (also fits A4)`} />
      <div className="label-stack">
        {parcels.map((parcel, i) => (
          <section key={i} className="label-sheet">
            <header className="label-head">
              <img src="/assets/img/email-logo.png" alt="Coastal Parcel" className="label-logo" />
              <div className="label-service">
                <span>{serviceLabel(s.serviceType ?? "") || "Standard"}</span>
                <strong>
                  {i + 1} of {total}
                </strong>
              </div>
            </header>

            <div className="label-block">
              <p className="label-tag">From</p>
              <p className="label-name">{s.senderName}</p>
              <p>{s.pickupAddress}</p>
              <p>
                {s.pickupCity}
                {s.pickupPostalCode ? ` ${s.pickupPostalCode}` : ""}, {s.pickupCountry}
              </p>
              <p>{s.senderPhone}</p>
            </div>

            <div className="label-block label-to">
              <p className="label-tag">Ship to</p>
              <p className="label-name">{s.receiverName}</p>
              <p>{s.deliveryAddress}</p>
              <p className="label-city">
                {s.deliveryCity}
                {s.deliveryPostalCode ? ` ${s.deliveryPostalCode}` : ""}
              </p>
              <p className="label-country">{s.deliveryCountry}</p>
              <p>{s.receiverPhone}</p>
            </div>

            <div className="label-facts">
              <div><span>Weight</span><strong>{weightBoth(parcel.weight)}</strong></div>
              <div><span>Contents</span><strong>{s.isDocument ? "Document" : parcel.description || "Package"}</strong></div>
              <div><span>Ship date</span><strong>{shipDate}</strong></div>
            </div>

            <div className="label-codes">
              <div className="label-barcode">
                <div className="label-svg" dangerouslySetInnerHTML={{ __html: barcode }} />
                <p className="label-tracking">{tracking}</p>
              </div>
              <div className="label-qr">
                <div className="label-svg" dangerouslySetInnerHTML={{ __html: qr }} />
                <p>Scan to track</p>
              </div>
            </div>

            <footer className="label-foot">coastalparcel.com · Info@coastalparcel.com · +234 707 583 6785</footer>
          </section>
        ))}
      </div>
    </div>
  );
}
