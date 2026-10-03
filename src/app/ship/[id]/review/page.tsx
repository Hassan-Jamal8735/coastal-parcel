import Link from "next/link";
import { redirect } from "next/navigation";
import { cardClass, Field, inputClass, outlineButton, primaryButton } from "@/components/ui";
import { WizardShell } from "@/components/wizard-shell";
import { CURRENCIES, formatMoney, serviceLabel, SHIPMENT_PURPOSES } from "@/lib/constants";
import { calculateFinalPrice, getPricingSettings } from "@/lib/pricing";
import { getPackages, requireAccessibleShipment } from "@/lib/shipments";
import { confirmBooking } from "../actions";

export const metadata = { title: "Review & Book" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await requireAccessibleShipment(id);
  if (s.status !== "draft") redirect(`/ship/${id}/pay`);
  if (!s.serviceType) redirect(`/ship/${id}/options`);
  const international = s.pickupCountry !== s.deliveryCountry;
  if (international && !s.customsItemDescription) redirect(`/ship/${id}/customs`);

  const [packages, rates] = await Promise.all([getPackages(id), getPricingSettings()]);
  const price = calculateFinalPrice(rates, {
    weightKg: s.packageWeight,
    distanceKm: s.distanceKm ?? 0,
    fulfillment: s.fulfillment,
    serviceType: s.serviceType,
    addons: s.addons,
  });

  return (
    <WizardShell step="Review" international={international} title="Review & Book" subtitle="Check everything below, then confirm to continue to payment.">
      <div className="space-y-6">
        <section className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Route</h2>
            <Link href={`/ship?edit=${id}`} className="text-sm font-bold underline">
              Edit
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              [
                ["From", s.senderName, s.senderPhone, s.pickupAddress, s.pickupCity, s.pickupPostalCode, s.pickupCountry],
                ["To", s.receiverName, s.receiverPhone, s.deliveryAddress, s.deliveryCity, s.deliveryPostalCode, s.deliveryCountry],
              ] as const
            ).map(([label, name, phone, address, city, postal, country]) => (
              <div key={label} className="text-sm">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
                <p className="font-bold">{name}</p>
                <p>{phone}</p>
                <p>{address}</p>
                <p>
                  {city}
                  {postal ? ` ${postal}` : ""}, {country}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 text-xl font-bold">Shipment</h2>
          <Row label="Service" value={`${serviceLabel(s.serviceType)} · ${s.deliveryEstimate ?? ""}`} />
          <Row label="Handover" value={s.fulfillment === "pickup" ? "Driver pickup" : "Drop-off at a Coastal Parcel location"} />
          <Row label="Contents" value={s.isDocument ? "Document" : "Package"} />
          <Row label="Purpose" value={SHIPMENT_PURPOSES[s.shipmentPurpose as keyof typeof SHIPMENT_PURPOSES] ?? "—"} />
          <Row label="Distance" value={`${s.distanceKm} km`} />
          {packages.map((p, i) => (
            <Row
              key={p.id}
              label={`Package ${i + 1}${p.description ? ` (${p.description})` : ""}`}
              value={`${p.pieces} × ${p.weight} kg${p.length && p.width && p.height ? ` · ${p.length}×${p.width}×${p.height} cm` : ""}`}
            />
          ))}
          <Row label="Total" value={`${s.packagePieces} piece(s), ${s.packageWeight} kg`} />
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 text-xl font-bold">Price</h2>
          <Row label="Transportation" value={formatMoney(Math.round(price.basePrice))} />
          {Math.abs(price.serviceAdjustment) > 0.01 && (
            <Row label={`${serviceLabel(s.serviceType)} service adjustment`} value={(price.serviceAdjustment < 0 ? "−" : "") + formatMoney(Math.round(Math.abs(price.serviceAdjustment)))} />
          )}
          {s.addons.map((key) => rates.addons[key] && <Row key={key} label={rates.addons[key].label} value={formatMoney(rates.addons[key].priceNgn)} />)}
          {price.pickupFee > 0 && <Row label="Pickup fee" value={formatMoney(price.pickupFee)} />}
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(Math.round(price.finalPrice))}</span>
          </div>
        </section>

        <form action={confirmBooking.bind(null, id)} className={cardClass + " space-y-4"}>
          <Field label="Pay in currency">
            <select name="currency" defaultValue="NGN" className={inputClass}>
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <option key={code} value={code}>
                  {code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted">Other currencies are converted from Naira at today&apos;s rate and locked in when you confirm.</p>
          <div className="flex justify-between gap-3">
            <Link href={international ? `/ship/${id}/customs` : `/ship/${id}/addons`} className={outlineButton}>
              Back
            </Link>
            <button className={primaryButton}>Confirm &amp; Continue to Payment</button>
          </div>
        </form>
      </div>
    </WizardShell>
  );
}
