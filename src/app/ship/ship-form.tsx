"use client";

import { useState, useTransition } from "react";
import { saveShipment } from "@/app/actions/ship-form";
import { ShipCardSection } from "@/components/ship-ui";
import { BoxPresets } from "@/components/box-presets";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { LocationPinPicker } from "@/components/location-pin-picker";
import { COUNTRIES, CURRENCIES, PROHIBITED_ITEMS, SHIPMENT_PURPOSES } from "@/lib/constants";
import { PhoneInput } from "@/components/phone-input";

type PackageRow = { description: string; weight: string; pieces: string; length: string; width: string; height: string };

export type Pin = { lat: number; lng: number };

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
  pickupPin: Pin | null;
  deliveryPin: Pin | null;
  packages: PackageRow[];
  shipmentPurpose: string;
  shipmentReference: string;
  pricingMethod: "location" | "mileage";
  distanceKm: string;
  notes: string;
};

const blankPackage: PackageRow = { description: "", weight: "", pieces: "1", length: "", width: "", height: "" };

export function ShipForm({ initial, isGuest }: { initial: ShipFormInitial; isGuest: boolean }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [estimate, setEstimate] = useState<{ value: string; meta: string } | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [presets, setPresets] = useState<Record<number, string>>({});

  const set = <K extends keyof ShipFormInitial>(key: K, value: ShipFormInitial[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const setPkg = (i: number, patch: Partial<PackageRow>) => setF((prev) => ({ ...prev, packages: prev.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const totalWeight = f.packages.reduce((s, p) => s + (parseFloat(p.weight) || 0) * (parseInt(p.pieces) || 0), 0);
  const totalPieces = f.packages.reduce((s, p) => s + (parseInt(p.pieces) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);

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
          value: res.currencySymbol + Number(res.displayAmount).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          meta: `${res.route} — ${res.distanceKm} km × ₦${res.ratePerKmNgn}/km + weight × ₦${res.ratePerKgNgn}/kg${res.currency !== "NGN" ? ` (converted to ${res.currency})` : ""}`,
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

  const location = (where: "pickup" | "delivery") => {
    const k = <S extends "City" | "PostalCode" | "Country" | "Address">(s: S) => `${where}${s}` as const;
    const label = where === "pickup" ? "Pickup" : "Delivery";
    return (
      <>
        <div className="form-field">
          <div className="label">{label} Address</div>
          <input className="field w-input" type="text" placeholder="Street address" required value={f[k("Address")]} onChange={(e) => set(k("Address"), e.target.value)} />
        </div>
        <div className="form-row-3col">
          <div className="form-field cp-city-autocomplete-wrap">
            <div className="label">{label} City</div>
            <CityAutocomplete
              required
              country={f[k("Country")]}
              value={f[k("City")]}
              placeholder={where === "pickup" ? "e.g. Lagos" : "e.g. London"}
              onChange={(city) => setF((prev) => ({ ...prev, [k("City")]: city }))}
              onPostalCode={(postal) => setF((prev) => (prev[k("PostalCode")] ? prev : { ...prev, [k("PostalCode")]: postal }))}
            />
          </div>
          <div className="form-field">
            <div className="label">Postal Code</div>
            <input className="field w-input" type="text" placeholder="Optional" value={f[k("PostalCode")]} onChange={(e) => set(k("PostalCode"), e.target.value)} />
          </div>
          <div className="form-field">
            <div className="label">{label} Country</div>
            <select
              className="field w-select"
              required
              value={f[k("Country")]}
              onChange={(e) => setF((prev) => ({ ...prev, [k("Country")]: e.target.value, [k("City")]: "", [k("PostalCode")]: "" }))}
            >
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
        <LocationPinPicker
          label={label}
          city={f[k("City")]}
          country={f[k("Country")]}
          value={f[`${where}Pin`]}
          onChange={(pin) => setF((prev) => ({ ...prev, [`${where}Pin`]: pin }))}
          allowGps={where === "pickup"}
        />
      </>
    );
  };

  return (
    <>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={submit} className="form-2" id="cp-ship-form">
        <ShipCardSection icon="calendar" title="Shipping Date & Type">
          <div className="form-row-2col">
            <div className="form-field">
              <div className="label">Shipping Date</div>
              <input className="field w-input" type="date" min={f.id ? undefined : today} required value={f.shippingDate} onChange={(e) => set("shippingDate", e.target.value)} />
            </div>
            <div className="form-field">
              <div className="label">What are you shipping?</div>
              <div className="ship-doc-toggle">
                {(
                  [
                    [false, "Package"],
                    [true, "Document"],
                  ] as const
                ).map(([val, label]) => (
                  <label key={label} className="ship-doc-toggle-option">
                    <input type="radio" name="is_document" checked={f.isDocument === val} onChange={() => set("isDocument", val)} />
                    <span className="ship-doc-toggle-check" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ShipCardSection>

        <ShipCardSection icon="sender" title="Sender (Pickup)">
          <div className="form-row-3col">
            <div className="form-field">
              <div className="label">Sender Name</div>
              <input className="field w-input" type="text" required value={f.senderName} onChange={(e) => set("senderName", e.target.value)} />
            </div>
            <div className="form-field">
              <div className="label">Sender Phone</div>
              <PhoneInput className="field w-input" required value={f.senderPhone} onValueChange={(v) => set("senderPhone", v)} />
            </div>
            <div className="form-field">
              <div className="label">Sender Email</div>
              <input className="field w-input" type="email" placeholder="you@example.com" required value={f.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} />
              {isGuest && (
                <p className="p-light" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
                  Used for your payment receipt and checkout &mdash; you can create an account after paying to track this shipment anytime.
                </p>
              )}
            </div>
          </div>
          {location("pickup")}
        </ShipCardSection>

        <ShipCardSection icon="receiver" title="Receiver (Delivery)">
          <div className="form-row-2col">
            <div className="form-field">
              <div className="label">Receiver Name</div>
              <input className="field w-input" type="text" required value={f.receiverName} onChange={(e) => set("receiverName", e.target.value)} />
            </div>
            <div className="form-field">
              <div className="label">Receiver Phone</div>
              <PhoneInput className="field w-input" required value={f.receiverPhone} onValueChange={(v) => set("receiverPhone", v)} />
            </div>
          </div>
          {location("delivery")}
        </ShipCardSection>

        <ShipCardSection icon="package" title="Packaging">
          <p className="p-light" style={{ margin: "0 0 16px" }}>
            Shipping more than one kind of item? Add a package row for each — a box of clothes and a crate of electronics don&apos;t have to be declared as one.
          </p>
          <div id="cp-packages-list">
            {f.packages.map((p, i) => (
              <div key={i} className="cp-package-row">
                <div className="cp-package-row-header">
                  <h4>
                    Package <span className="cp-package-row-number">{i + 1}</span>
                  </h4>
                  <button
                    type="button"
                    className="cp-package-remove"
                    title="Remove this package"
                    style={{ visibility: f.packages.length > 1 ? "visible" : "hidden" }}
                    onClick={() => setF((prev) => ({ ...prev, packages: prev.packages.filter((_, j) => j !== i) }))}
                  >
                    &times;
                  </button>
                </div>
                <div className="form-row-3col">
                  <div className="form-field">
                    <div className="label">Description (optional)</div>
                    <input className="field w-input" type="text" placeholder="e.g. Clothes" value={p.description} onChange={(e) => setPkg(i, { description: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <div className="label">Weight per piece (kg)</div>
                    <input className="field w-input" type="number" step="0.1" min="0.1" required value={p.weight} onChange={(e) => setPkg(i, { weight: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <div className="label">Number of pieces</div>
                    <input className="field w-input" type="number" step="1" min="1" required value={p.pieces} onChange={(e) => setPkg(i, { pieces: e.target.value })} />
                  </div>
                </div>
                {!f.isDocument && (
                  <>
                    <div className="cp-package-dims form-row-3col">
                      {(["length", "width", "height"] as const).map((d) => (
                        <div key={d} className="form-field">
                          <div className="label">{d[0].toUpperCase() + d.slice(1)} (cm)</div>
                          <input className="field w-input" type="number" step="0.1" min="0" value={p[d]} onChange={(e) => setPkg(i, { [d]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <BoxPresets
                      active={presets[i]}
                      onPick={(b) => {
                        setPresets((prev) => ({ ...prev, [i]: b.key }));
                        setPkg(i, { length: String(b.l), width: String(b.w), height: String(b.h), weight: String(b.weight) });
                      }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="shipnow-btn shipnow-btn-outline"
            style={{ margin: "12px 0 4px" }}
            onClick={() => setF((prev) => ({ ...prev, packages: [...prev.packages, { ...blankPackage }] }))}
          >
            + Add Another Package
          </button>
          <div className="cp-packages-total">
            Total: <strong>{totalPieces}</strong> piece(s), <strong>{totalWeight.toFixed(2)}</strong> kg
          </div>
        </ShipCardSection>

        <ShipCardSection icon="tag" title="Purpose & Reference">
          <div className="form-row-2col">
            <div className="form-field">
              <div className="label">Purpose of shipment</div>
              <select className="field w-select" required value={f.shipmentPurpose} onChange={(e) => set("shipmentPurpose", e.target.value)}>
                <option value="" disabled>
                  Select purpose
                </option>
                {Object.entries(SHIPMENT_PURPOSES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <div className="label">Shipment Reference (optional)</div>
              <input className="field w-input" type="text" placeholder="Your own reference number" value={f.shipmentReference} onChange={(e) => set("shipmentReference", e.target.value)} />
            </div>
          </div>
          <p className="p-light" style={{ margin: 0 }}>
            If supplied, your reference will appear on the shipping label.
          </p>
          <details className="ship-prohibited-details">
            <summary>View Prohibited Items</summary>
            <ul className="ship-prohibited-list">
              {PROHIBITED_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </ShipCardSection>

        <ShipCardSection icon="route" title="Pricing Method">
          <div className="ship-pricing-tabs">
            {(
              [
                ["location", "By Location (recommended)"],
                ["mileage", "Same-City / Manual Distance"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={"ship-pricing-tab" + (f.pricingMethod === key ? " active" : "")} onClick={() => set("pricingMethod", key)}>
                {label}
              </button>
            ))}
          </div>
          <div className={"ship-pricing-panel" + (f.pricingMethod === "location" ? " active" : "")}>
            <p className="p-light" style={{ marginBottom: 12 }}>
              We&apos;ll geocode the pickup and delivery city/country entered above and calculate the real distance between them automatically &mdash; this is the right
              choice for almost every shipment.
            </p>
          </div>
          <div className={"ship-pricing-panel" + (f.pricingMethod === "mileage" ? " active" : "")}>
            <p className="p-light" style={{ marginBottom: 12 }}>
              Only needed for a delivery within the same city, where geocoding two nearby points isn&apos;t precise enough &mdash; enter the actual distance yourself.
            </p>
            <div className="form-field">
              <div className="label">Distance (km)</div>
              <input className="field w-input" type="number" step="0.1" min="0" required={f.pricingMethod === "mileage"} value={f.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} />
            </div>
          </div>
          {estimate && (
            <div className="cp-estimate-box" style={{ display: "block" }}>
              <div className="cp-estimate-header">
                <p className="cp-estimate-label">Estimated Price</p>
                <select
                  className="cp-estimate-currency"
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    runEstimate(e.target.value);
                  }}
                >
                  {Object.keys(CURRENCIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <p className="cp-estimate-value">{estimate.value}</p>
              <p className="cp-estimate-meta">{estimate.meta}</p>
            </div>
          )}
          {estimateError && (
            <p className="cp-estimate-error" style={{ display: "block" }}>
              {estimateError}
            </p>
          )}
          <button type="button" className="button-2 w-button cp-secondary-btn" style={{ marginBottom: 0 }} disabled={estimating} onClick={() => runEstimate()}>
            {estimating ? "Calculating…" : "Calculate Price"}
          </button>
        </ShipCardSection>

        <ShipCardSection icon="note" title="Notes (optional)">
          <div className="form-field" style={{ margin: 0 }}>
            <textarea className="field extra w-input" placeholder="Anything the driver or admin should know" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </ShipCardSection>

        <input type="submit" className="button-2 w-button" value={pending ? "Saving…" : f.id ? "Save Changes" : "Continue"} disabled={pending} />
      </form>
    </>
  );
}
