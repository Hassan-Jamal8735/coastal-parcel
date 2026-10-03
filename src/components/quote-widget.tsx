"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/constants";
import { CityAutocomplete } from "./city-autocomplete";

// The widget offers a wider currency list than checkout (estimates only).
const WIDGET_CURRENCIES: [string, string][] = [
  ["NGN", "Nigerian Naira"], ["USD", "US Dollar"], ["GBP", "British Pound"], ["EUR", "Euro"], ["CAD", "Canadian Dollar"],
  ["AUD", "Australian Dollar"], ["ZAR", "South African Rand"], ["GHS", "Ghanaian Cedi"], ["KES", "Kenyan Shilling"],
  ["EGP", "Egyptian Pound"], ["INR", "Indian Rupee"], ["CNY", "Chinese Yuan"], ["JPY", "Japanese Yen"], ["AED", "UAE Dirham"],
  ["SAR", "Saudi Riyal"], ["QAR", "Qatari Riyal"], ["BRL", "Brazilian Real"], ["MXN", "Mexican Peso"], ["CHF", "Swiss Franc"],
  ["SEK", "Swedish Krona"], ["NOK", "Norwegian Krone"], ["DKK", "Danish Krone"], ["PLN", "Polish Zloty"], ["TRY", "Turkish Lira"],
  ["SGD", "Singapore Dollar"], ["HKD", "Hong Kong Dollar"], ["NZD", "New Zealand Dollar"], ["THB", "Thai Baht"],
  ["MYR", "Malaysian Ringgit"], ["IDR", "Indonesian Rupiah"], ["PHP", "Philippine Peso"], ["VND", "Vietnamese Dong"],
  ["PKR", "Pakistani Rupee"], ["BDT", "Bangladeshi Taka"], ["KRW", "South Korean Won"], ["ARS", "Argentine Peso"],
  ["CLP", "Chilean Peso"], ["COP", "Colombian Peso"], ["PEN", "Peruvian Sol"], ["MAD", "Moroccan Dirham"],
  ["TND", "Tunisian Dinar"], ["DZD", "Algerian Dinar"], ["ETB", "Ethiopian Birr"], ["UGX", "Ugandan Shilling"],
  ["TZS", "Tanzanian Shilling"], ["RWF", "Rwandan Franc"], ["XOF", "West African CFA Franc"], ["XAF", "Central African CFA Franc"],
  ["ILS", "Israeli Shekel"], ["KWD", "Kuwaiti Dinar"], ["BHD", "Bahraini Dinar"], ["OMR", "Omani Rial"], ["JOD", "Jordanian Dinar"],
  ["LKR", "Sri Lankan Rupee"], ["NPR", "Nepalese Rupee"], ["RUB", "Russian Ruble"],
];

function formatMoney(amount: number, cur: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${cur} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

type Result = { value: string; meta: string; ctaHref: string | null };

/** The "Get a shipping estimate" widget (WordPress template-parts/quote-widget.php) — same markup and CSS. */
export function QuoteWidget() {
  const [currency, setCurrency] = useState("USD");
  const [currencies, setCurrencies] = useState(WIDGET_CURRENCIES);
  const [curNote, setCurNote] = useState("Detecting your location…");
  const [tab, setTab] = useState<"mileage" | "location">("mileage");
  const [mileage, setMileage] = useState({ distance: "", weight: "" });
  const [loc, setLoc] = useState({ oCountry: "Nigeria", oCity: "", oPostal: "", dCountry: "", dCity: "", dPostal: "", weight: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [lastRun, setLastRun] = useState<"mileage" | "location" | null>(null);

  // Auto-pick the visitor's currency from their location (falls back to USD).
  useEffect(() => {
    let detected = "USD";
    fetch("https://ipwho.is/")
      .then((r) => r.json())
      .then((geo) => {
        if (geo && geo.success !== false && geo.currency?.code) detected = geo.currency.code;
      })
      .catch(() => {})
      .finally(() => {
        setCurrencies((list) => (list.some(([c]) => c === detected) ? list : [[detected, detected], ...list]));
        setCurrency(detected);
        setCurNote(`Currency auto-set to ${detected} based on your location`);
      });
  }, []);

  async function request(params: Record<string, unknown>, cur: string) {
    const res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, currency: cur }),
    }).catch(() => null);
    if (!res) throw new Error("Network error — please try again.");
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  async function calculate(which = tab, cur = currency) {
    setError("");
    try {
      if (which === "mileage") {
        const km = parseFloat(mileage.distance);
        const weight = parseFloat(mileage.weight);
        if (!(km > 0) || !(weight > 0)) throw new Error("Please enter a distance and parcel weight greater than 0.");
        setResult({ value: "…", meta: "Calculating…", ctaHref: null });
        const d = await request({ pricingMethod: "mileage", weightKg: weight, distanceKm: km }, cur);
        setResult({
          value: formatMoney(d.displayAmount, cur),
          meta: `${d.distanceKm.toLocaleString("en-US")} km × ${formatMoney(d.ratePerKmNgn, "NGN")}/km + ${weight.toLocaleString("en-US")} kg × ${formatMoney(d.ratePerKgNgn, "NGN")}/kg${cur !== "NGN" ? ` (converted to ${cur})` : ""}`,
          ctaHref: "/ship?" + new URLSearchParams({ pricing_method: "mileage", distance_km: String(km), package_weight: String(weight) }),
        });
      } else {
        const weight = parseFloat(loc.weight);
        if (!loc.oCountry || !loc.oCity.trim() || !loc.dCountry || !loc.dCity.trim() || !loc.dPostal.trim() || !(weight > 0)) {
          throw new Error("Please fill in all fields, including a parcel weight greater than 0.");
        }
        setResult({ value: "…", meta: "Looking up the real distance between these locations…", ctaHref: null });
        const d = await request(
          { pricingMethod: "location", weightKg: weight, originCity: loc.oCity.trim(), originCountry: loc.oCountry, destinationCity: loc.dCity.trim(), destinationCountry: loc.dCountry },
          cur,
        );
        setResult({
          value: formatMoney(d.displayAmount, cur),
          meta: `${loc.oCity}, ${loc.oCountry} → ${loc.dCity} (${loc.dPostal}), ${loc.dCountry} — ${d.distanceKm.toLocaleString("en-US")} km × ${formatMoney(d.ratePerKmNgn, "NGN")}/km + ${weight.toLocaleString("en-US")} kg × ${formatMoney(d.ratePerKgNgn, "NGN")}/kg${cur !== "NGN" ? ` (converted to ${cur})` : ""}`,
          ctaHref:
            "/ship?" +
            new URLSearchParams({
              pricing_method: "location",
              package_weight: String(weight),
              pickup_city: loc.oCity.trim(),
              pickup_country: loc.oCountry,
              pickup_postal_code: loc.oPostal.trim(),
              delivery_city: loc.dCity.trim(),
              delivery_country: loc.dCountry,
              delivery_postal_code: loc.dPostal.trim(),
            }),
        });
      }
      setLastRun(which);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  }

  return (
    <div id="lpq-widget">
      <div className="lpq-header">
        <div>
          <h3>Get a shipping estimate</h3>
          <p className="lpq-sub">Choose how you&apos;d like to get your quote.</p>
        </div>
        <div className="lpq-currency-wrap">
          <select
            className="lpq-currency-select"
            aria-label="Currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              if (result && lastRun) calculate(lastRun, e.target.value);
            }}
          >
            {currencies.map(([code, name]) => (
              <option key={code} value={code}>
                {code === name ? code : `${code} — ${name}`}
              </option>
            ))}
          </select>
          <p className="lpq-cur-note">{curNote}</p>
        </div>
      </div>

      <div className="lpq-tabs" role="tablist" aria-label="Quote method">
        {(["mileage", "location"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={"lpq-tab" + (tab === t ? " active" : "")}
            onClick={() => {
              setTab(t);
              setResult(null);
              setError("");
            }}
          >
            {t === "mileage" ? "By Mileage" : "By Location"}
          </button>
        ))}
      </div>

      <div className={"lpq-panel" + (tab === "mileage" ? " lpq-active" : "")}>
        <label htmlFor="lpq-distance">Distance</label>
        <div className="lpq-input-row lpq-distance-row">
          <input type="number" id="lpq-distance" min="0" step="0.1" placeholder="e.g. 120" value={mileage.distance} onChange={(e) => setMileage({ ...mileage, distance: e.target.value })} />
          <span className="lpq-unit">km</span>
        </div>
        <label htmlFor="lpq-weight-mileage">Parcel weight</label>
        <div className="lpq-input-row lpq-distance-row">
          <input type="number" id="lpq-weight-mileage" min="0" step="0.1" placeholder="e.g. 5" value={mileage.weight} onChange={(e) => setMileage({ ...mileage, weight: e.target.value })} />
          <span className="lpq-unit">kg</span>
        </div>
      </div>

      <div className={"lpq-panel" + (tab === "location" ? " lpq-active" : "")}>
        <p className="lpq-section-label">From</p>
        <div className="lpq-input-row">
          <label htmlFor="lpq-origin-country">Origin country</label>
          <select id="lpq-origin-country" value={loc.oCountry} onChange={(e) => setLoc({ ...loc, oCountry: e.target.value, oCity: "", oPostal: "" })}>
            <option value="" disabled>Select origin country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="lpq-row-2col">
          <div className="lpq-input-row cp-city-autocomplete-wrap">
            <label>Origin city</label>
            <CityAutocomplete className="" country={loc.oCountry} value={loc.oCity} placeholder="e.g. Lagos" onChange={(c) => setLoc((l) => ({ ...l, oCity: c }))} onPostalCode={(p) => setLoc((l) => (l.oPostal ? l : { ...l, oPostal: p }))} />
          </div>
          <div className="lpq-input-row">
            <label htmlFor="lpq-origin-postal">Postal code</label>
            <input type="text" id="lpq-origin-postal" placeholder="e.g. 100001" value={loc.oPostal} onChange={(e) => setLoc({ ...loc, oPostal: e.target.value })} />
          </div>
        </div>

        <div className="lpq-divider" />

        <p className="lpq-section-label">To</p>
        <div className="lpq-input-row">
          <label htmlFor="lpq-dest-country">Destination country</label>
          <select id="lpq-dest-country" value={loc.dCountry} onChange={(e) => setLoc({ ...loc, dCountry: e.target.value, dCity: "", dPostal: "" })}>
            <option value="" disabled>Select destination country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="lpq-row-2col">
          <div className="lpq-input-row cp-city-autocomplete-wrap">
            <label>Destination city</label>
            <CityAutocomplete className="" country={loc.dCountry} value={loc.dCity} placeholder="e.g. London" onChange={(c) => setLoc((l) => ({ ...l, dCity: c }))} onPostalCode={(p) => setLoc((l) => (l.dPostal ? l : { ...l, dPostal: p }))} />
          </div>
          <div className="lpq-input-row">
            <label htmlFor="lpq-dest-postal">Postal code</label>
            <input type="text" id="lpq-dest-postal" placeholder="e.g. SW1A" value={loc.dPostal} onChange={(e) => setLoc({ ...loc, dPostal: e.target.value })} />
          </div>
        </div>

        <div className="lpq-input-row lpq-distance-row">
          <label htmlFor="lpq-weight-location">Parcel weight</label>
          <input type="number" id="lpq-weight-location" min="0" step="0.1" placeholder="e.g. 5" value={loc.weight} onChange={(e) => setLoc({ ...loc, weight: e.target.value })} />
          <span className="lpq-unit">kg</span>
        </div>
      </div>

      <p className={"lpq-error" + (error ? " lpq-show" : "")}>{error || "Please fill in all required fields."}</p>

      <button type="button" className="lpq-submit" onClick={() => calculate()}>
        Calculate price
      </button>

      <div className={"lpq-result" + (result ? " lpq-show" : "")}>
        <p className="lpq-result-label">Estimated price</p>
        <p className="lpq-result-value">{result?.value ?? "—"}</p>
        <p className="lpq-result-meta">{result?.meta}</p>
        {result?.ctaHref && (
          <a href={result.ctaHref} className="lpq-cta" style={{ display: "inline-block" }}>
            Create This Shipment &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
