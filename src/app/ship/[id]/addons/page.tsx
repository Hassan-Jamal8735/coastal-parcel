import Link from "next/link";
import { redirect } from "next/navigation";
import { cardClass, outlineButton, primaryButton } from "@/components/ui";
import { WizardShell } from "@/components/wizard-shell";
import { formatMoney } from "@/lib/constants";
import { getPricingSettings } from "@/lib/pricing";
import { requireAccessibleShipment } from "@/lib/shipments";
import { selectAddons } from "../actions";

export const metadata = { title: "Optional Services" };

export default async function AddonsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await requireAccessibleShipment(id);
  if (s.status !== "draft") redirect(`/ship/${id}/pay`);
  if (!s.serviceType) redirect(`/ship/${id}/options`);
  const rates = await getPricingSettings();

  return (
    <WizardShell
      step="Add-ons"
      international={s.pickupCountry !== s.deliveryCountry}
      title="Optional Services"
      subtitle="Select any additional services you want for your shipment. Charges may apply."
    >
      <form action={selectAddons.bind(null, id)} className="space-y-3">
        {Object.entries(rates.addons).map(([key, addon]) => (
          <label key={key} className={cardClass + " flex cursor-pointer items-start gap-4 has-[:checked]:border-brand has-[:checked]:bg-brand/5"}>
            <input type="checkbox" name="addons" value={key} defaultChecked={s.addons.includes(key)} className="mt-1 h-5 w-5 accent-[#f9b416]" />
            <span className="flex-1">
              <span className="flex items-center justify-between gap-4">
                <span className="font-bold">{addon.label}</span>
                <span className="font-bold">{formatMoney(addon.priceNgn)}</span>
              </span>
              <span className="mt-1 block text-sm text-muted">{addon.description}</span>
            </span>
          </label>
        ))}
        <div className="flex justify-between gap-3 pt-4">
          <Link href={`/ship/${id}/options`} className={outlineButton}>
            Back
          </Link>
          <button className={primaryButton}>Continue</button>
        </div>
      </form>
    </WizardShell>
  );
}
