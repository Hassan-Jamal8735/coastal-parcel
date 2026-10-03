import Link from "next/link";
import { redirect } from "next/navigation";
import { confirmBooking } from "@/app/actions/booking-steps";
import { BookingLayout } from "@/components/booking-layout";
import { serviceLabel } from "@/lib/constants";
import { getPricingSettings, ngnRates } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";
import { CurrencyPreview } from "./currency-preview";

export const metadata = { title: "Booking" };

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ shipment_id?: string }> }) {
  const { shipment_id } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status !== "draft") redirect(`/pay?shipment_id=${s.id}`);
  if (!s.serviceType) redirect(`/shipping-options?shipment_id=${s.id}`);
  const international = s.pickupCountry !== s.deliveryCountry;
  if (international && !s.customsItemDescription) redirect(`/customs-invoice?shipment_id=${s.id}`);

  const [rates, fx] = await Promise.all([getPricingSettings(), ngnRates()]);
  const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <BookingLayout active="shipments">
      <h1 className="mb-20">Review Your Shipment</h1>
      <p className="p-light">Confirm the details below before proceeding to payment.</p>

      <h3 className="ship-section-heading">Route</h3>
      <p>
        <strong>
          {s.pickupCity}
          {s.pickupPostalCode ? ` ${s.pickupPostalCode}` : ""}, {s.pickupCountry}
        </strong>{" "}
        &rarr;{" "}
        <strong>
          {s.deliveryCity}
          {s.deliveryPostalCode ? ` ${s.deliveryPostalCode}` : ""}, {s.deliveryCountry}
        </strong>
      </p>
      <p className="p-light">
        {s.pickupAddress} to {s.deliveryAddress}
      </p>

      <h3 className="ship-section-heading">Sender / Receiver</h3>
      <p>
        <strong>From:</strong> {s.senderName} ({s.senderPhone})
      </p>
      <p>
        <strong>To:</strong> {s.receiverName} ({s.receiverPhone})
      </p>

      <h3 className="ship-section-heading">Package</h3>
      <p>
        {serviceLabel(s.serviceType)} &middot; {s.packagePieces || 1} pc(s) &middot; {s.packageWeight} kg
        {s.deliveryEstimate ? ` · Delivery in ${s.deliveryEstimate}` : ""}{" "}
        <Link href={`/shipping-options?shipment_id=${s.id}`} className="ship-options-edit-link">
          Edit
        </Link>
      </p>

      {s.addons.length > 0 && (
        <>
          <h3 className="ship-section-heading">Optional Services</h3>
          <ul style={{ margin: "0 0 20px", paddingLeft: 20 }}>
            {s.addons.map(
              (key) =>
                rates.addons[key] && (
                  <li key={key}>
                    {rates.addons[key].label} &mdash; &#8358;{fmt(rates.addons[key].priceNgn)}
                  </li>
                ),
            )}
          </ul>
        </>
      )}

      {international && s.customsItemDescription && (
        <>
          <h3 className="ship-section-heading">
            Customs Invoice{" "}
            <Link href={`/customs-invoice?shipment_id=${s.id}`} className="ship-options-edit-link">
              Edit
            </Link>
          </h3>
          <p>
            <strong>Item:</strong> {s.customsItemDescription} &middot; <strong>Origin:</strong> {s.customsCountryOfOrigin}
          </p>
          <p>
            <strong>Declared Value:</strong> &#8358;{fmt(s.customsDeclaredValueNgn ?? 0, 2)}
            {s.customsCommodityCode && (
              <>
                {" "}
                &middot; <strong>Commodity Code:</strong> {s.customsCommodityCode}
              </>
            )}
          </p>
          {s.customsRemarks && <p className="p-light">{s.customsRemarks}</p>}
        </>
      )}

      <form action={confirmBooking.bind(null, s.id)}>
        <CurrencyPreview ngnBase={s.priceAmount} rates={fx} />
        <div className="spacer-20" />
        <div className="ship-wizard-actions">
          <Link href={international ? `/customs-invoice?shipment_id=${s.id}` : `/optional-services?shipment_id=${s.id}`} className="button-2 outline w-button">
            Back
          </Link>
          <input type="submit" className="button-2 w-button" value="Confirm Booking & Continue to Payment" />
        </div>
      </form>
    </BookingLayout>
  );
}
