import Link from "next/link";
import { redirect } from "next/navigation";
import { saveCustoms } from "@/app/actions/customs";
import { BookingLayout, ShipnowStepper } from "@/components/booking-layout";
import { COUNTRIES } from "@/lib/constants";
import { getPackages, requireAccessibleShipment } from "@/lib/shipments";

export const metadata = { title: "Customs Invoice" };

export default async function CustomsInvoicePage({ searchParams }: { searchParams: Promise<{ shipment_id?: string; error?: string }> }) {
  const { shipment_id, error } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status !== "draft") redirect(`/booking?shipment_id=${s.id}`);
  if (!s.serviceType) redirect(`/shipping-options?shipment_id=${s.id}`);
  // Domestic shipments skip customs entirely.
  if (s.pickupCountry === s.deliveryCountry) redirect(`/booking?shipment_id=${s.id}`);
  const packages = await getPackages(s.id);

  return (
    <BookingLayout active="ship">
      <ShipnowStepper current={3} />
      <h1 className="mb-20">Customs Invoice</h1>
      <p className="p-light">Describe the item in your shipment &mdash; required for shipments crossing an international border.</p>

      {error && <div className="auth-error">{error}</div>}

      {packages.length > 1 && (
        <div className="cp-packages-total" style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Packages in this shipment:</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontWeight: 400 }}>
            {packages.map((p) => (
              <li key={p.id}>
                {p.pieces}&times; {p.description || "Package"} &mdash; {p.weight} kg each
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={saveCustoms.bind(null, s.id)}>
        <h3 className="ship-section-heading">Shipment Item</h3>
        <div className="form-field">
          <div className="label">Item Description</div>
          <input className="field w-input" type="text" name="customs_item_description" placeholder="e.g. Cotton t-shirts" defaultValue={s.customsItemDescription ?? ""} required />
        </div>
        <div className="form-row-2col">
          <div className="form-field">
            <div className="label">Commodity Code (optional)</div>
            <input className="field w-input" type="text" name="customs_commodity_code" defaultValue={s.customsCommodityCode ?? ""} />
          </div>
          <div className="form-field">
            <div className="label">Country of Origin</div>
            <select className="field w-select" name="customs_country_of_origin" required defaultValue={s.customsCountryOfOrigin ?? ""}>
              <option value="" disabled>
                Select country
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row-3col">
          <div className="form-field">
            <div className="label">Qty</div>
            <input className="field w-input" type="text" value={s.packagePieces || 1} readOnly />
          </div>
          <div className="form-field">
            <div className="label">Total Weight (kg)</div>
            <input className="field w-input" type="text" value={s.packageWeight} readOnly />
          </div>
          <div className="form-field">
            <div className="label">Declared Value (&#8358;)</div>
            <input className="field w-input" type="number" step="0.01" min="0.01" name="customs_declared_value_ngn" defaultValue={s.customsDeclaredValueNgn ?? ""} required />
          </div>
        </div>

        <h3 className="ship-section-heading">Remarks (optional)</h3>
        <div className="form-field">
          <textarea className="field extra w-input" name="customs_remarks" placeholder="Remarks will be printed on the customs invoice" defaultValue={s.customsRemarks ?? ""} />
        </div>

        <h3 className="ship-section-heading">Signature &amp; Logo (optional)</h3>
        <div className="form-row-2col">
          {(
            [
              ["customs_signature", "Signature", s.customsSignatureUrl],
              ["customs_logo", "Company Logo", s.customsLogoUrl],
            ] as const
          ).map(([name, label, url]) => (
            <div key={name} className="form-field">
              <div className="label">{label}</div>
              <input className="field w-input" type="file" name={name} accept="image/*" />
              {url && (
                <p className="p-light">
                  Currently uploaded:{" "}
                  <a href={url} target="_blank" rel="noopener">
                    view
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>

        <label className="shipnow-checkbox-row" style={{ margin: "16px 0 24px" }}>
          <input type="checkbox" name="customs_electronic" value="1" defaultChecked={s.customsElectronic} />
          <span>Yes, I want to send my customs paperwork electronically.</span>
        </label>

        <div className="ship-wizard-actions">
          <Link href={`/optional-services?shipment_id=${s.id}`} className="button-2 outline w-button">
            Back
          </Link>
          <input type="submit" className="button-2 w-button" value="Continue" />
        </div>
      </form>
    </BookingLayout>
  );
}
