import Link from "next/link";
import { redirect } from "next/navigation";
import { selectAddons } from "@/app/actions/booking-steps";
import { BookingLayout, ShipnowStepper } from "@/components/booking-layout";
import { getPricingSettings } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";

export const metadata = { title: "Optional Services" };

export default async function OptionalServicesPage({ searchParams }: { searchParams: Promise<{ shipment_id?: string }> }) {
  const { shipment_id } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status !== "draft") redirect(`/booking?shipment_id=${s.id}`);
  if (!s.serviceType) redirect(`/shipping-options?shipment_id=${s.id}`);
  const rates = await getPricingSettings();

  return (
    <BookingLayout active="ship">
      <ShipnowStepper current={2} />
      <h1 className="mb-20">Optional Services</h1>
      <p className="p-light">Select the additional services you want for your shipment. Charges may apply.</p>

      <form action={selectAddons.bind(null, s.id)}>
        <div className="shipnow-addon-list">
          {Object.entries(rates.addons).map(([key, addon]) => (
            <label key={key} className="shipnow-addon-option">
              <input type="checkbox" name="addons" value={key} defaultChecked={s.addons.includes(key)} />
              <div className="shipnow-addon-option-body">
                <div className="shipnow-addon-option-header">
                  <span className="shipnow-addon-option-name">{addon.label}</span>
                  <span className="shipnow-addon-option-price">&#8358;{addon.priceNgn.toLocaleString("en-US")}</span>
                </div>
                <p className="shipnow-addon-option-desc">{addon.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="ship-wizard-actions">
          <Link href={`/shipping-options?shipment_id=${s.id}`} className="button-2 outline w-button">
            Back
          </Link>
          <input type="submit" className="button-2 w-button" value="Continue" />
        </div>
      </form>
    </BookingLayout>
  );
}
