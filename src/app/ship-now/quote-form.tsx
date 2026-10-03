"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BoxPresets } from "@/components/box-presets";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { COUNTRIES } from "@/lib/constants";

type Quote = { displayAmount: number; currencySymbol: string; distanceKm: number; route: string; error?: string };
type Loc = { country: string; city: string; postal: string };

function LocationBlock({ label, loc, setLoc, placeholder }: { label: string; loc: Loc; setLoc: React.Dispatch<React.SetStateAction<Loc>>; placeholder: string }) {
  return (
    <div className="shipnow-location-block">
      <p className="shipnow-block-label">{label}</p>
      <div className="form-field">
        <div className="label">Country</div>
        <select className="field w-select" value={loc.country} onChange={(e) => setLoc({ country: e.target.value, city: "", postal: "" })}>
          {label === "To" && (
            <option value="" disabled>
              Select country
            </option>
          )}
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row-2col">
        <div className="form-field cp-city-autocomplete-wrap">
          <div className="label">City</div>
          <CityAutocomplete
            country={loc.country}
            value={loc.city}
            placeholder={placeholder}
            onChange={(city) => setLoc((l) => ({ ...l, city }))}
            onPostalCode={(postal) => setLoc((l) => (l.postal ? l : { ...l, postal }))}
          />
        </div>
        <div className="form-field">
          <div className="label">Postal Code</div>
          <input className="field w-input" type="text" placeholder="Optional" value={loc.postal} onChange={(e) => setLoc((l) => ({ ...l, postal: e.target.value }))} />
        </div>
      </div>
      <label className="shipnow-checkbox-row">
        <input type="checkbox" />
        <span>This is a residential address</span>
      </label>
    </div>
  );
}

export function QuoteForm({ prefill }: { prefill: Record<string, string | undefined> }) {
  const [origin, setOrigin] = useState<Loc>({ country: prefill.origin_country ?? "Nigeria", city: prefill.origin_city ?? "", postal: prefill.origin_postal ?? "" });
  const [dest, setDest] = useState<Loc>({ country: prefill.dest_country ?? "", city: prefill.dest_city ?? "", postal: prefill.dest_postal ?? "" });
  const [pkg, setPkg] = useState({
    weight: prefill.weight ?? "5",
    quantity: Math.max(1, parseInt(prefill.quantity ?? "1") || 1),
    length: prefill.length ?? "",
    width: prefill.width ?? "",
    height: prefill.height ?? "",
  });
  const [preset, setPreset] = useState<string>();
  const [showItem, setShowItem] = useState(Boolean(prefill.origin_city));
  const [locError, setLocError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<{ dropoff: Quote; pickup: Quote } | null>(null);
  const [copied, setCopied] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const locationsReady = Boolean(origin.city.trim() && origin.country && dest.city.trim() && dest.country);

  const getQuote = useCallback(async () => {
    setError("");
    const weight = parseFloat(pkg.weight);
    if (!locationsReady || !(weight > 0)) {
      setError("Please fill in the origin, destination, and a parcel weight greater than 0.");
      setQuotes(null);
      return;
    }
    setLoading(true);
    const request = (fulfillment: string): Promise<Quote> =>
      fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingMethod: "location",
          weightKg: weight,
          originCity: origin.city.trim(),
          originCountry: origin.country,
          destinationCity: dest.city.trim(),
          destinationCountry: dest.country,
          fulfillment,
        }),
      }).then((r) => r.json());
    try {
      const [dropoff, pickup] = await Promise.all([request("dropoff"), request("pickup")]);
      if (dropoff.error || pickup.error) {
        setError(dropoff.error ?? pickup.error ?? "Could not calculate a quote.");
        setQuotes(null);
      } else {
        setQuotes({ dropoff, pickup });
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [locationsReady, pkg.weight, origin, dest]);

  // Opening a shared quote link reproduces the same quote automatically.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRan.current && prefill.origin_city && prefill.dest_city) {
      autoRan.current = true;
      getQuote();
    }
  }, [prefill.origin_city, prefill.dest_city, getQuote]);

  function shipUrl(fulfillment: string) {
    return (
      "/ship?" +
      new URLSearchParams({
        pricing_method: "location",
        package_weight: pkg.weight,
        package_pieces: String(pkg.quantity),
        package_length: pkg.length,
        package_width: pkg.width,
        package_height: pkg.height,
        pickup_city: origin.city.trim(),
        pickup_country: origin.country,
        pickup_postal_code: origin.postal.trim(),
        delivery_city: dest.city.trim(),
        delivery_country: dest.country,
        delivery_postal_code: dest.postal.trim(),
        fulfillment,
      })
    );
  }

  function shareUrl() {
    const p = new URLSearchParams({
      weight: pkg.weight,
      quantity: String(pkg.quantity),
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
      origin_city: origin.city.trim(),
      origin_country: origin.country,
      origin_postal: origin.postal.trim(),
      dest_city: dest.city.trim(),
      dest_country: dest.country,
      dest_postal: dest.postal.trim(),
    });
    return `${window.location.origin}/ship-now?${p}`;
  }

  const eta = origin.country === dest.country ? "Estimated delivery in 2–3 days" : "Estimated delivery in 5–10 days";
  const price = (q: Quote) => q.currencySymbol + q.displayAmount.toLocaleString("en-US");

  return (
    <>
      <div className="shipnow-card">
        <div className="shipnow-from-to">
          <LocationBlock label="From" loc={origin} setLoc={setOrigin} placeholder="e.g. Lagos" />
          <LocationBlock label="To" loc={dest} setLoc={setDest} placeholder="e.g. London" />
        </div>
        {locError && <p className="shipnow-error">{locError}</p>}
        <button
          type="button"
          className="shipnow-btn shipnow-btn-solid shipnow-get-quote"
          onClick={() => {
            if (!locationsReady) return setLocError("Please fill in both the origin and destination before continuing.");
            setLocError("");
            setShowItem(true);
            setTimeout(() => itemRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        >
          Describe Your Shipment &rarr;
        </button>
      </div>

      <div ref={itemRef} className="shipnow-card shipnow-item-card" style={showItem ? undefined : { display: "none" }}>
        <p className="shipnow-block-label">Shipment</p>
        <div className="form-row-3col">
          <div className="form-field">
            <div className="label">Weight (kg)</div>
            <input className="field w-input" type="number" step="0.1" min="0.1" value={pkg.weight} onChange={(e) => setPkg({ ...pkg, weight: e.target.value })} />
          </div>
          <div className="form-field">
            <div className="label">Quantity</div>
            <div className="shipnow-qty-stepper">
              <button type="button" className="shipnow-qty-btn" onClick={() => setPkg({ ...pkg, quantity: Math.max(1, pkg.quantity - 1) })}>
                &minus;
              </button>
              <input className="field w-input" type="number" min="1" value={pkg.quantity} readOnly />
              <button type="button" className="shipnow-qty-btn" onClick={() => setPkg({ ...pkg, quantity: pkg.quantity + 1 })}>
                +
              </button>
            </div>
          </div>
          <div className="form-field" />
        </div>
        <div className="form-row-3col">
          {(["length", "width", "height"] as const).map((d) => (
            <div key={d} className="form-field">
              <div className="label">{d[0].toUpperCase() + d.slice(1)} (cm)</div>
              <input className="field w-input" type="number" step="0.1" min="0" placeholder="0" value={pkg[d]} onChange={(e) => setPkg({ ...pkg, [d]: e.target.value })} />
            </div>
          ))}
        </div>
        <BoxPresets
          active={preset}
          onPick={(b) => {
            setPreset(b.key);
            setPkg({ ...pkg, length: String(b.l), width: String(b.w), height: String(b.h), weight: String(b.weight) });
          }}
        />
        <button type="button" className="shipnow-btn shipnow-btn-solid shipnow-get-quote" onClick={getQuote} disabled={loading}>
          {loading ? "Calculating…" : "Get a Quote"}
        </button>
        {error && <p className="shipnow-error">{error}</p>}
      </div>

      {quotes && (
        <div ref={resultsRef} className="shipnow-results">
          <h2 className="shipnow-results-title">Your Quotes</h2>
          {(
            [
              ["dropoff", "Drop-off at Coastal Parcel Location", "shipnow-badge-green", ""],
              ["pickup", "Schedule a Pickup", "shipnow-badge-blue", " · includes pickup fee"],
            ] as const
          ).map(([key, title, badge, extra]) => (
            <div key={key} className="shipnow-quote-option">
              <div className="shipnow-quote-option-header">
                <span className={"shipnow-quote-badge " + badge}>{title}</span>
                <span className="shipnow-quote-price">{price(quotes[key])}</span>
              </div>
              <p className="shipnow-quote-meta">
                {quotes[key].route} — {quotes[key].distanceKm} km · {eta}
                {extra}
              </p>
              <Link href={shipUrl(key)} className="shipnow-btn shipnow-btn-solid">
                Complete Shipment Details &rarr;
              </Link>
            </div>
          ))}
          <div className="shipnow-quote-actions">
            <button
              type="button"
              className="shipnow-btn shipnow-btn-outline"
              onClick={() =>
                navigator.clipboard.writeText(shareUrl()).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              type="button"
              className="shipnow-btn shipnow-btn-outline"
              onClick={() => {
                window.location.href = `mailto:?subject=${encodeURIComponent("My Coastal Parcel Shipping Quote")}&body=${encodeURIComponent("Here is my shipping quote: " + shareUrl())}`;
              }}
            >
              Email Quotes
            </button>
            <button type="button" className="shipnow-btn shipnow-btn-outline" onClick={() => window.print()}>
              Print Quotes
            </button>
          </div>
          <p className="shipnow-quote-disclaimer">Prices are estimates based on the details provided and today&apos;s exchange rates. The final amount is confirmed at checkout.</p>
        </div>
      )}
    </>
  );
}
