"use client";

import { useState, useTransition } from "react";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { cardClass, CountryOptions, Field, inputClass, primaryButton } from "@/components/ui";
import { BOX_PRESETS, COUNTRIES, CURRENCIES, PROHIBITED_ITEMS, SHIPMENT_PURPOSES } from "@/lib/constants";
import { saveShipment } from "./actions";

type PackageRow = { description: string; weight: string; pieces: string; length: string; width: string; height: string };

export type ShipFormInitial = {
  id?: number;
  fulfillment: "dropoff" | "pickup";
  shippingDate: string;
  isDocument: boolean;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode: string;
  pickupCountry: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  packages: PackageRow[];
  shipmentPurpose: string;
  shipmentReference: string;
  pricingMethod: "location" | "mileage";
  distanceKm: string;
  notes: string;
};

const blankPackage: PackageRow = { description: "", weight: "", pieces: "1", length: "", width: "", height: "" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cardClass}>
      <h2 className="mb-5 text-xl font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ShipForm({ initial }: { initial: ShipFormInitial }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [estimate, setEstimate] = useState<{ text: string; meta: string } | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [showProhibited, setShowProhibited] = useState(false);

  const set = <K extends keyof ShipFormInitial>(key: K, value: ShipFormInitial[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const setPkg = (i: number, patch: Partial<PackageRow>) =>
    setF((prev) => ({ ...prev, packages: prev.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const totalWeight = f.packages.reduce((s, p) => s + (parseFloat(p.weight) || 0) * (parseInt(p.pieces) || 0), 0);
  const totalPieces = f.packages.reduce((s, p) => s + (parseInt(p.pieces) || 0), 0);

  async function runEstimate(cur = currency) {
    setEstimateError("");
    setEstimating(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingMethod: f.pricingMethod,
          weightKg: totalWeight,
          distanceKm: f.distanceKm,
          originCity: f.pickupCity,
          originCountry: f.pickupCountry,
          destinationCity: f.deliveryCity,
          destinationCountry: f.deliveryCountry,
          fulfillment: f.fulfillment,
          currency: cur,
        }),
      }).then((r) => r.json());
      if (res.error) {
        setEstimate(null);
        setEstimateError(res.error);
      } else {
        setEstimate({
          text: res.currencySymbol + res.displayAmount.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          meta: `${res.route} — ${res.distanceKm} km × ₦${res.ratePerKmNgn}/km + ${totalWeight} kg × ₦${res.ratePerKgNgn}/kg${res.currency !== "NGN" ? ` (converted to ${res.currency})` : ""}`,
        });
      }
    } catch {
      setEstimateError("Network error — please try again.");
    } finally {
      setEstimating(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await saveShipment({ ...f, distanceKm: f.distanceKm || undefined });
      // saveShipment redirects on success; it only returns when something's wrong.
      if (result?.error) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Section title="Shipping Date & Type">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipping date">
            <input type="date" className={inputClass} value={f.shippingDate} onChange={(e) => set("shippingDate", e.target.value)} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-semibold">What are you shipping?</span>
            <div className="flex gap-3">
              {[
                [false, "Package"],
                [true, "Document"],
              ].map(([val, label]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => set("isDocument", val as boolean)}
                  className={
                    "flex-1 rounded-lg border px-4 py-3 font-semibold " +
                    (f.isDocument === val ? "border-brand bg-brand/10" : "border-line bg-white")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {(
        [
          ["Sender (Pickup)", "sender", "pickup", "e.g. Lagos"],
          ["Receiver (Delivery)", "receiver", "delivery", "e.g. London"],
        ] as const
      ).map(([title, who, where, ph]) => {
        const k = (s: string) => `${where}${s}` as keyof ShipFormInitial;
        return (
          <Section key={who} title={title}>
            <div className={"grid gap-4 " + (who === "sender" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <Field label="Name">
                <input required className={inputClass} value={f[`${who}Name`]} onChange={(e) => set(`${who}Name`, e.target.value)} />
              </Field>
              <Field label="Phone">
                <input required type="tel" className={inputClass} value={f[`${who}Phone`]} onChange={(e) => set(`${who}Phone`, e.target.value)} />
              </Field>
              {who === "sender" && (
                <Field label="Email">
                  <input required type="email" className={inputClass} value={f.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} />
                </Field>
              )}
            </div>
            <Field label="Address">
              <input required className={inputClass} placeholder="Street address" value={f[k("Address")] as string} onChange={(e) => set(k("Address"), e.target.value as never)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Country">
                <select
                  required
                  className={inputClass}
                  value={f[k("Country")] as string}
                  onChange={(e) => setF((prev) => ({ ...prev, [k("Country")]: e.target.value, [k("City")]: "", [k("PostalCode")]: "" }))}
                >
                  <option value="" disabled>Select country</option>
                  <CountryOptions countries={COUNTRIES} />
                </select>
              </Field>
              <Field label="City">
                <CityAutocomplete
                  required
                  country={f[k("Country")] as string}
                  value={f[k("City")] as string}
                  onChange={(city) => setF((prev) => ({ ...prev, [k("City")]: city }))}
                  onPostalCode={(postal) => setF((prev) => (prev[k("PostalCode")] ? prev : { ...prev, [k("PostalCode")]: postal }))}
                  placeholder={ph}
                  className={inputClass}
                />
              </Field>
              <Field label="Postal code">
                <input className={inputClass} placeholder="Optional" value={f[k("PostalCode")] as string} onChange={(e) => set(k("PostalCode"), e.target.value as never)} />
              </Field>
            </div>
          </Section>
        );
      })}

      <Section title="Packaging">
        <p className="text-sm text-muted">
          Shipping more than one kind of item? Add a row for each — a box of clothes and a crate of electronics don&apos;t have to be declared as one.
        </p>
        {f.packages.map((p, i) => (
          <div key={i} className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Package {i + 1}</h3>
              {f.packages.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove package ${i + 1}`}
                  onClick={() => setF((prev) => ({ ...prev, packages: prev.packages.filter((_, j) => j !== i) }))}
                  className="h-8 w-8 rounded-full border border-line text-danger hover:bg-danger/5"
                >
                  ×
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Description (optional)">
                <input className={inputClass} placeholder="e.g. Clothes" value={p.description} onChange={(e) => setPkg(i, { description: e.target.value })} />
              </Field>
              <Field label="Weight per piece (kg)">
                <input required type="number" min="0.1" step="0.1" className={inputClass} value={p.weight} onChange={(e) => setPkg(i, { weight: e.target.value })} />
              </Field>
              <Field label="Number of pieces">
                <input required type="number" min="1" step="1" className={inputClass} value={p.pieces} onChange={(e) => setPkg(i, { pieces: e.target.value })} />
              </Field>
            </div>
            {!f.isDocument && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {(["length", "width", "height"] as const).map((d) => (
                    <Field key={d} label={`${d[0].toUpperCase()}${d.slice(1)} (cm)`}>
                      <input type="number" min="0" step="0.1" className={inputClass} value={p[d]} onChange={(e) => setPkg(i, { [d]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BOX_PRESETS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setPkg(i, { length: String(b.l), width: String(b.w), height: String(b.h), weight: String(b.weight) })}
                      className="rounded-lg border border-line bg-cream px-2 py-2 text-xs font-bold hover:border-brand"
                    >
                      {b.label}
                      <span className="block font-normal text-muted">
                        {b.l}×{b.w}×{b.h} cm
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setF((prev) => ({ ...prev, packages: [...prev.packages, { ...blankPackage }] }))}
          className="rounded-lg border-2 border-dashed border-line px-4 py-2 text-sm font-bold hover:border-brand"
        >
          + Add Another Package
        </button>
        <p className="rounded-lg bg-cream px-4 py-3 text-sm font-semibold">
          Total: {totalPieces} piece(s), {totalWeight.toFixed(2)} kg
        </p>
      </Section>

      <Section title="Purpose & Reference">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What is the purpose of your shipment?">
            <select required className={inputClass} value={f.shipmentPurpose} onChange={(e) => set("shipmentPurpose", e.target.value)}>
              <option value="" disabled>Select purpose</option>
              {Object.entries(SHIPMENT_PURPOSES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shipment reference (optional)">
            <input className={inputClass} placeholder="Your own reference number" value={f.shipmentReference} onChange={(e) => set("shipmentReference", e.target.value)} />
          </Field>
        </div>
        <button type="button" onClick={() => setShowProhibited((v) => !v)} className="text-sm font-bold underline">
          {showProhibited ? "Hide" : "View"} prohibited items
        </button>
        {showProhibited && (
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted">
            {PROHIBITED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pricing">
        <div className="flex gap-6 border-b border-line">
          {(
            [
              ["location", "By Location (recommended)"],
              ["mileage", "Same-City / Manual Distance"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set("pricingMethod", key)}
              className={"-mb-px border-b-[3px] pb-3 text-sm font-semibold " + (f.pricingMethod === key ? "border-brand text-ink" : "border-transparent text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        {f.pricingMethod === "location" ? (
          <p className="text-sm text-muted">We calculate the real distance between the pickup and delivery cities above automatically.</p>
        ) : (
          <Field label="Distance (km)">
            <p className="mb-2 text-xs text-muted">Only needed within the same city, where two nearby points are too close to measure precisely.</p>
            <input type="number" min="0.1" step="0.1" className={inputClass} value={f.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} />
          </Field>
        )}
        <button type="button" onClick={() => runEstimate()} disabled={estimating} className="w-full rounded-lg bg-ink py-3 font-bold text-white disabled:opacity-60">
          {estimating ? "Calculating…" : "Calculate Price"}
        </button>
        {estimateError && <p className="text-sm text-danger">{estimateError}</p>}
        {estimate && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">Estimated price</p>
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  runEstimate(e.target.value);
                }}
                className="rounded-md border border-line bg-white px-2 py-1 text-sm"
              >
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-3xl font-bold">{estimate.text}</p>
            <p className="mt-1 text-xs text-muted">{estimate.meta}</p>
          </div>
        )}
      </Section>

      <Section title="Notes (optional)">
        <textarea
          rows={4}
          className={inputClass}
          placeholder="Anything the driver or our team should know"
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Section>

      <button type="submit" disabled={pending} className={primaryButton + " w-full"}>
        {pending ? "Saving…" : f.id ? "Save Changes" : "Continue"}
      </button>
    </form>
  );
}
