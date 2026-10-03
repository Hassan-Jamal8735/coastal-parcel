"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { BOX_PRESETS, COUNTRIES } from "@/lib/constants";
import { cardClass, CountryOptions, Field, inputClass, outlineButton, primaryButton } from "@/components/ui";

type Quote = { displayAmount: number; currencySymbol: string; distanceKm: number; route: string; error?: string };
type Loc = { country: string; city: string; postal: string };

function LocationBlock({ label, loc, setLoc, placeholder }: { label: string; loc: Loc; setLoc: React.Dispatch<React.SetStateAction<Loc>>; placeholder: string }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <Field label="Country">
        <select className={inputClass} value={loc.country} onChange={(e) => setLoc({ country: e.target.value, city: "", postal: "" })}>
          {!loc.country && <option value="" disabled>Select country</option>}
          <CountryOptions countries={COUNTRIES} />
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <CityAutocomplete
            country={loc.country}
            value={loc.city}
            onChange={(city) => setLoc((l) => ({ ...l, city }))}
            onPostalCode={(postal) => setLoc((l) => (l.postal ? l : { ...l, postal }))}
            placeholder={placeholder}
            className={inputClass}
          />
        </Field>
        <Field label="Postal Code">
          <input className={inputClass} value={loc.postal} placeholder="Optional" onChange={(e) => setLoc((l) => ({ ...l, postal: e.target.value }))} />
        </Field>
      </div>
    </div>
  );
}

export function QuoteForm({ prefill }: { prefill: Record<string, string | undefined> }) {
  const [origin, setOrigin] = useState<Loc>({ country: prefill.origin_country ?? "Nigeria", city: prefill.origin_city ?? "", postal: prefill.origin_postal ?? "" });
  const [dest, setDest] = useState<Loc>({ country: prefill.dest_country ?? "", city: prefill.dest_city ?? "", postal: prefill.dest_postal ?? "" });
  const [pkg, setPkg] = useState({
    weight: prefill.weight ?? "5",
    quantity: prefill.quantity ?? "1",
    length: prefill.length ?? "",
    width: prefill.width ?? "",
    height: prefill.height ?? "",
  });
  const [showPackage, setShowPackage] = useState(Boolean(prefill.origin_city));
  const [quotes, setQuotes] = useState<{ dropoff: Quote; pickup: Quote } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const packageRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const locationsReady = Boolean(origin.city.trim() && origin.country && dest.city.trim() && dest.country);
  const totalWeight = (parseFloat(pkg.weight) || 0) * (parseInt(pkg.quantity) || 1);

  const getQuote = useCallback(async () => {
    setError("");
    if (!locationsReady || totalWeight <= 0) {
      setError("Please fill in the origin, destination, and a parcel weight greater than 0.");
      return;
    }
    setLoading(true);
    const request = (fulfillment: string): Promise<Quote> =>
      fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingMethod: "location",
          weightKg: totalWeight,
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
  }, [locationsReady, totalWeight, origin, dest]);

  // Opening a shared quote link reproduces the same quote automatically.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRan.current && prefill.origin_city && prefill.dest_city) {
      autoRan.current = true;
      getQuote();
    }
  }, [prefill.origin_city, prefill.dest_city, getQuote]);

  function shipUrl(fulfillment: string) {
    const p = new URLSearchParams({
      fulfillment,
      pickup_city: origin.city.trim(),
      pickup_country: origin.country,
      pickup_postal: origin.postal,
      delivery_city: dest.city.trim(),
      delivery_country: dest.country,
      delivery_postal: dest.postal,
      weight: pkg.weight,
      pieces: pkg.quantity,
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
    });
    return `/ship?${p}`;
  }

  function shareUrl() {
    const p = new URLSearchParams({
      origin_country: origin.country,
      origin_city: origin.city,
      origin_postal: origin.postal,
      dest_country: dest.country,
      dest_city: dest.city,
      dest_postal: dest.postal,
      weight: pkg.weight,
      quantity: pkg.quantity,
      length: pkg.length,
      width: pkg.width,
      height: pkg.height,
    });
    return `${window.location.origin}/ship-now?${p}`;
  }

  const eta = origin.country === dest.country ? "Estimated delivery in 2–3 days" : "Estimated delivery in 5–10 days";

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="grid gap-8 md:grid-cols-2">
          <LocationBlock label="From" loc={origin} setLoc={setOrigin} placeholder="e.g. Lagos" />
          <LocationBlock label="To" loc={dest} setLoc={setDest} placeholder="e.g. London" />
        </div>
        {!showPackage && (
          <>
            <button
              type="button"
              className={primaryButton + " mt-8 w-full"}
              onClick={() => {
                if (!locationsReady) return setError("Please fill in both the origin and destination before continuing.");
                setError("");
                setShowPackage(true);
                setTimeout(() => packageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
            >
              Describe Your Shipment →
            </button>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </>
        )}
      </section>

      {showPackage && (
        <section ref={packageRef} className={cardClass}>
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">Shipment</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Weight per piece (kg)">
              <input type="number" min="0.1" step="0.1" className={inputClass} value={pkg.weight} onChange={(e) => setPkg({ ...pkg, weight: e.target.value })} />
            </Field>
            <Field label="Quantity">
              <input type="number" min="1" step="1" className={inputClass} value={pkg.quantity} onChange={(e) => setPkg({ ...pkg, quantity: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {(["length", "width", "height"] as const).map((d) => (
              <Field key={d} label={`${d[0].toUpperCase()}${d.slice(1)} (cm)`}>
                <input type="number" min="0" step="0.1" className={inputClass} value={pkg[d]} onChange={(e) => setPkg({ ...pkg, [d]: e.target.value })} />
              </Field>
            ))}
          </div>
          <p className="mb-2 mt-6 text-sm font-semibold text-muted">Not sure about the size?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BOX_PRESETS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setPkg({ ...pkg, length: String(b.l), width: String(b.w), height: String(b.h), weight: String(b.weight) })}
                className="rounded-xl border border-line bg-cream px-3 py-4 text-center text-sm font-bold hover:border-brand"
              >
                {b.label}
                <span className="block text-xs font-normal text-muted">
                  {b.l}×{b.w}×{b.h} cm
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={getQuote} disabled={loading} className={primaryButton + " mt-8 w-full"}>
            {loading ? "Calculating…" : "Get a Quote"}
          </button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </section>
      )}

      {quotes && (
        <section ref={resultsRef} className="space-y-4">
          <h2 className="text-2xl font-bold">Your Quotes</h2>
          {(
            [
              ["dropoff", "Drop-off at Coastal Parcel Location", "bg-success", ""],
              ["pickup", "Schedule a Pickup", "bg-[#1c6fd9]", " · includes pickup fee"],
            ] as const
          ).map(([key, title, badge, extra]) => {
            const q = quotes[key];
            return (
              <div key={key} className={cardClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-bold text-white ${badge}`}>{title}</span>
                  <span className="text-2xl font-bold">
                    {q.currencySymbol}
                    {q.displayAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {q.route} — {q.distanceKm} km · {eta}
                  {extra}
                </p>
                <Link href={shipUrl(key)} className={primaryButton + " mt-4 w-full"}>
                  Complete Shipment Details →
                </Link>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              className={outlineButton}
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
              className={outlineButton}
              onClick={() => {
                window.location.href = `mailto:?subject=${encodeURIComponent("My Coastal Parcel Shipping Quote")}&body=${encodeURIComponent("Here is my shipping quote: " + shareUrl())}`;
              }}
            >
              Email Quotes
            </button>
            <button type="button" className={outlineButton} onClick={() => window.print()}>
              Print Quotes
            </button>
          </div>
          <p className="text-xs text-muted">
            Prices are estimates based on the details provided and today&apos;s exchange rates. The final amount is confirmed at checkout.
          </p>
        </section>
      )}
    </div>
  );
}
