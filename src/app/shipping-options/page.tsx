import Link from "next/link";
import { redirect } from "next/navigation";
import { selectService } from "@/app/actions/booking-steps";
import { BookingLayout, ShipnowStepper } from "@/components/booking-layout";
import { SERVICE_TYPES } from "@/lib/constants";
import { calculateFinalPrice, deliveryEstimate, getPricingSettings } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";

export const metadata = { title: "Shipping Options" };

export default async function ShippingOptionsPage({ searchParams }: { searchParams: Promise<{ shipment_id?: string; error?: string }> }) {
  const { shipment_id, error } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status !== "draft") redirect(`/booking?shipment_id=${s.id}`);
  const rates = await getPricingSettings();
  const isDomestic = s.pickupCountry === s.deliveryCountry;
  const now = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <BookingLayout active="ship">
      <ShipnowStepper current={2} />
      <h1 className="mb-20">Shipping Options</h1>
      <p className="p-light">
        Your selection: {s.packageWeight} kg &middot; {s.pickupCity}, {s.pickupCountry} &rarr; {s.deliveryCity}, {s.deliveryCountry}{" "}
        <Link href={`/ship?edit=${s.id}`} className="ship-options-edit-link">
          Edit
        </Link>
      </p>
      {error && <div className="auth-error">Please select a shipping option.</div>}

      <form action={selectService.bind(null, s.id)}>
        <div className="shipnow-service-options">
          {Object.entries(SERVICE_TYPES).map(([key, label]) => {
            const b = calculateFinalPrice(rates, { weightKg: s.packageWeight, distanceKm: s.distanceKm ?? 0, fulfillment: s.fulfillment, serviceType: key });
            return (
              <label key={key} className="shipnow-service-option">
                <input type="radio" name="service_type" value={key} defaultChecked={key === (s.serviceType || "door_to_door")} />
                <div className="shipnow-service-option-body">
                  <div className="shipnow-service-option-header">
                    <span className="shipnow-service-option-name">{label}</span>
                    <span className="shipnow-service-option-price">&#8358;{Math.round(b.basePrice + b.serviceAdjustment).toLocaleString("en-US")}</span>
                  </div>
                  <p className="shipnow-service-option-meta">Delivery in {deliveryEstimate(key, isDomestic)}</p>
                </div>
              </label>
            );
          })}
        </div>

        <p className="shipnow-rate-note">Rate estimate as of {now}</p>

        <div className="ship-wizard-actions">
          <Link href={`/ship?edit=${s.id}`} className="button-2 outline w-button">
            Back
          </Link>
          <input type="submit" className="button-2 w-button" value="Continue" />
        </div>
      </form>
    </BookingLayout>
  );
}
