import Link from "next/link";
import { redirect } from "next/navigation";
import { CountryOptions, cardClass, Field, inputClass, outlineButton, primaryButton } from "@/components/ui";
import { WizardShell } from "@/components/wizard-shell";
import { COUNTRIES } from "@/lib/constants";
import { getPackages, requireAccessibleShipment } from "@/lib/shipments";
import { saveCustoms } from "./actions";

export const metadata = { title: "Customs Invoice" };

export default async function CustomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const id = Number((await params).id);
  const s = await requireAccessibleShipment(id);
  if (s.status !== "draft") redirect(`/ship/${id}/pay`);
  if (!s.serviceType) redirect(`/ship/${id}/options`);
  if (s.pickupCountry === s.deliveryCountry) redirect(`/ship/${id}/review`);
  const { error } = await searchParams;
  const packages = await getPackages(id);

  return (
    <WizardShell step="Customs" title="Customs Invoice" subtitle="Required for shipments crossing an international border.">
      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      <form action={saveCustoms.bind(null, id)} className="space-y-6">
        <section className={cardClass + " space-y-4"}>
          <h2 className="text-xl font-bold">Shipment Item</h2>
          {packages.length > 1 && (
            <div className="rounded-lg bg-cream px-4 py-3 text-sm">
              <p className="mb-1 font-bold">Packages in this shipment:</p>
              <ul className="list-disc pl-5">
                {packages.map((p) => (
                  <li key={p.id}>
                    {p.pieces}× {p.description || "Package"} — {p.weight} kg each
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Field label="Item description">
            <input name="description" required className={inputClass} placeholder="e.g. Cotton t-shirts" defaultValue={s.customsItemDescription ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commodity code (optional)">
              <input name="commodityCode" className={inputClass} defaultValue={s.customsCommodityCode ?? ""} />
            </Field>
            <Field label="Country of origin">
              <select name="countryOfOrigin" required className={inputClass} defaultValue={s.customsCountryOfOrigin ?? ""}>
                <option value="" disabled>
                  Select country
                </option>
                <CountryOptions countries={COUNTRIES} />
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantity">
              <input readOnly className={inputClass + " bg-cream"} value={s.packagePieces} />
            </Field>
            <Field label="Total weight (kg)">
              <input readOnly className={inputClass + " bg-cream"} value={s.packageWeight} />
            </Field>
            <Field label="Declared value (₦)">
              <input name="declaredValue" required type="number" min="0.01" step="0.01" className={inputClass} defaultValue={s.customsDeclaredValueNgn ?? ""} />
            </Field>
          </div>
        </section>

        <section className={cardClass + " space-y-4"}>
          <h2 className="text-xl font-bold">Remarks (optional)</h2>
          <textarea name="remarks" rows={3} className={inputClass} placeholder="Printed on the customs invoice" defaultValue={s.customsRemarks ?? ""} />
        </section>

        <section className={cardClass + " space-y-4"}>
          <h2 className="text-xl font-bold">Signature &amp; Logo (optional)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["signature", "Signature", s.customsSignatureUrl],
                ["logo", "Company logo", s.customsLogoUrl],
              ] as const
            ).map(([name, label, url]) => (
              <Field key={name} label={label}>
                <input name={name} type="file" accept="image/*" className={inputClass} />
                {url && (
                  <a href={url} target="_blank" rel="noopener" className="mt-1 block text-sm underline">
                    View current {label.toLowerCase()}
                  </a>
                )}
              </Field>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="electronic" defaultChecked={s.customsElectronic} className="h-5 w-5 accent-[#f9b416]" />
            Yes, send my customs paperwork electronically.
          </label>
        </section>

        <div className="flex justify-between gap-3">
          <Link href={`/ship/${id}/addons`} className={outlineButton}>
            Back
          </Link>
          <button className={primaryButton}>Continue</button>
        </div>
      </form>
    </WizardShell>
  );
}
