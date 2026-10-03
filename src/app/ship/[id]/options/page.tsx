import Link from "next/link";
import { redirect } from "next/navigation";
import { cardClass, outlineButton, primaryButton } from "@/components/ui";
import { WizardShell } from "@/components/wizard-shell";
import { formatMoney, SERVICE_TYPES } from "@/lib/constants";
import { calculateFinalPrice, deliveryEstimate, getPricingSettings } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";
import { selectService } from "../actions";

export const metadata = { title: "Shipping Options" };

export default async function OptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const id = Number((await params).id);
  const s = await requireAccessibleShipment(id);
  if (s.status !== "draft") redirect(`/ship/${id}/pay`);
  const { error } = await searchParams;
  const rates = await getPricingSettings();
  const isDomestic = s.pickupCountry === s.deliveryCountry;

  return (
    <WizardShell step="Options" international={!isDomestic} title="Shipping Options" subtitle={`${s.pickupCity} → ${s.deliveryCity} · ${s.packagePieces} piece(s), ${s.packageWeight} kg`}>
      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">Please choose a shipping option.</p>}
      <form action={selectService.bind(null, id)} className="space-y-3">
        {Object.entries(SERVICE_TYPES).map(([key, label]) => {
          const price = calculateFinalPrice(rates, {
            weightKg: s.packageWeight,
            distanceKm: s.distanceKm ?? 0,
            fulfillment: s.fulfillment,
            serviceType: key,
            addons: s.addons,
          });
          return (
            <label key={key} className={cardClass + " flex cursor-pointer items-center gap-4 has-[:checked]:border-brand has-[:checked]:bg-brand/5"}>
              <input type="radio" name="serviceType" value={key} defaultChecked={s.serviceType === key} required className="h-5 w-5 accent-[#f9b416]" />
              <span className="flex-1">
                <span className="block font-bold">{label}</span>
                <span className="text-sm text-muted">Delivery in {deliveryEstimate(key, isDomestic)}</span>
              </span>
              <span className="text-xl font-bold">{formatMoney(Math.round(price.finalPrice))}</span>
            </label>
          );
        })}
        <div className="flex justify-between gap-3 pt-4">
          <Link href={`/ship?edit=${id}`} className={outlineButton}>
            Back
          </Link>
          <button className={primaryButton}>Continue</button>
        </div>
      </form>
    </WizardShell>
  );
}
