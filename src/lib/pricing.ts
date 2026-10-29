import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cities, settings } from "@/db/schema";
import { packageTypeLabel, type ServiceType } from "./constants";

/**
 * A flat price for one package type on one route (e.g. a 55-gallon barrel
 * from the United States to Nigeria), set in Back Office → Pricing. It
 * replaces the distance and weight price for those pieces. Prices are in
 * USD so they stay fixed whatever the exchange rate does.
 */
export type FixedRoute = { packageType: string; from: string; to: string; priceUsd: number; pickupUsd: number; deliveryUsd: number };

/** What a shipment's fixed-route pieces come to, saved on the shipment. */
export type FixedPrice = { label: string; pieces: number; weightKg: number; freightUsd: number; pickupUsd: number; deliveryUsd: number };

/**
 * Pricing engine — same formula and defaults as the WordPress version
 * (inc/pricing.php), so quotes stay identical after the move. All rates are
 * in NGN; other currencies are display/charge conversions only.
 */
export const DEFAULT_PRICING = {
  ratePerKmNgn: 350,
  ratePerKgNgn: 500,
  pickupFeeNgn: 1500,
  // Fixed handling charge per piece of a package type (e.g. a barrel), set in Back Office → Pricing.
  packageCharges: {} as Record<string, number>,
  fixedRoutes: [
    { packageType: "barrel", from: "United States", to: "Nigeria", priceUsd: 200, pickupUsd: 50, deliveryUsd: 50 },
  ] as FixedRoute[],
  // NGN per 1 USD, refreshed from the exchange rate service in getPricingSettings (this is the fallback).
  usdNgn: 1600,
  serviceMultipliers: { air: 1.3, land: 1.0, ocean: 0.85, door_to_door: 1.2 } as Record<ServiceType, number>,
  addons: {
    signature: {
      label: "Signature Required Delivery",
      description: "A valid ID and signature from the receiver (or a representative) is required at delivery.",
      priceNgn: 500,
    },
    insurance: {
      label: "Shipment Insurance",
      description: "Covers loss or damage in transit up to the declared value of your shipment.",
      priceNgn: 1000,
    },
    fragile: {
      label: "Fragile Handling",
      description: "Extra care handling and packaging for delicate or breakable items.",
      priceNgn: 300,
    },
  } as Record<string, { label: string; description: string; priceNgn: number }>,
};
export type PricingSettings = typeof DEFAULT_PRICING;

/** The three rates that can differ per country (all in NGN). */
export type CountryRates = { ratePerKmNgn: number; ratePerKgNgn: number; pickupFeeNgn: number };
type SavedPricing = Partial<PricingSettings> & { countries?: Record<string, CountryRates> };

async function savedPricing(): Promise<SavedPricing> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "pricing")).limit(1);
  return (row?.value ?? {}) as SavedPricing;
}

/** Per-country rates set in the backoffice, keyed by country name. */
export async function getCountryRates(): Promise<Record<string, CountryRates>> {
  return (await savedPricing()).countries ?? {};
}

/**
 * Rates for a shipment, chosen by the country it ships FROM: that country's
 * own rates when the backoffice has set them, otherwise the default rates
 * ("All other countries"). Called without a country = the defaults.
 */
export async function getPricingSettings(originCountry?: string): Promise<PricingSettings> {
  const { countries, ...saved } = await savedPricing();
  const own = originCountry ? countries?.[originCountry] : undefined;
  const usdPerNgn = (await ngnRates()).USD;
  return {
    ...DEFAULT_PRICING,
    ...saved,
    ...own,
    usdNgn: usdPerNgn ? 1 / usdPerNgn : DEFAULT_PRICING.usdNgn,
    serviceMultipliers: { ...DEFAULT_PRICING.serviceMultipliers, ...saved.serviceMultipliers },
    addons: { ...DEFAULT_PRICING.addons, ...saved.addons },
    packageCharges: { ...DEFAULT_PRICING.packageCharges, ...saved.packageCharges },
  };
}

export function fixedRouteFor(rates: PricingSettings, packageType: string | null | undefined, from: string, to: string) {
  return packageType ? rates.fixedRoutes.find((r) => r.packageType === packageType && r.from === from && r.to === to) : undefined;
}

/**
 * The fixed-route part of a shipment, or null when none of its packages has
 * a fixed price on this route. `weight` is per piece, in kg. Home pickup and
 * delivery fees are charged once per shipment (the highest if several routes match).
 */
export function fixedPriceFor(
  rates: PricingSettings,
  packages: { packageType?: string | null; pieces: number; weight: number }[],
  from: string,
  to: string,
): FixedPrice | null {
  let fixed = null as FixedPrice | null;
  for (const p of packages) {
    const route = fixedRouteFor(rates, p.packageType, from, to);
    if (!route) continue;
    const pieces = Math.max(1, p.pieces);
    const label = packageTypeLabel(route.packageType) ?? route.packageType;
    fixed = {
      label: fixed && fixed.label !== label ? "Fixed-price packages" : label,
      pieces: (fixed?.pieces ?? 0) + pieces,
      weightKg: (fixed?.weightKg ?? 0) + p.weight * pieces,
      freightUsd: (fixed?.freightUsd ?? 0) + route.priceUsd * pieces,
      pickupUsd: Math.max(fixed?.pickupUsd ?? 0, route.pickupUsd),
      deliveryUsd: Math.max(fixed?.deliveryUsd ?? 0, route.deliveryUsd),
    };
  }
  return fixed;
}

/** Handling charges for a set of packages: each piece of a type with a charge adds it. Fixed-route pieces have none. */
export function packageChargesNgn(rates: PricingSettings, packages: { packageType?: string | null; pieces: number }[], route?: { from: string; to: string }) {
  return packages.reduce((sum, p) => {
    if (!p.packageType || (route && fixedRouteFor(rates, p.packageType, route.from, route.to))) return sum;
    return sum + (rates.packageCharges[p.packageType] ?? 0) * Math.max(1, p.pieces);
  }, 0);
}

export function basePriceNgn(rates: PricingSettings, weightKg: number, distanceKm: number) {
  return distanceKm * rates.ratePerKmNgn + weightKg * rates.ratePerKgNgn;
}

/**
 * Single source of truth for a shipment's price: base (distance + weight)
 * × service multiplier + add-ons + pickup fee + fixed-route charges. Always
 * recomputed from the raw inputs, so re-selecting options never compounds
 * an already-adjusted price.
 *
 * Fixed-route pieces (e.g. barrels to Nigeria) are taken out of the base:
 * their weight isn't charged, and a shipment of only those pieces has no
 * distance charge either. Their flat price isn't changed by the service type,
 * and on that route home pickup and home delivery cost the route's own fees.
 */
export function calculateFinalPrice(
  rates: PricingSettings,
  input: {
    weightKg: number;
    distanceKm: number;
    fulfillment: string;
    serviceType?: string;
    addons?: string[];
    packageCharges?: number;
    fixed?: FixedPrice | null;
    homeDelivery?: boolean;
  },
) {
  const fixed = input.fixed;
  const pricedKg = Math.max(0, input.weightKg - (fixed?.weightKg ?? 0));
  const base = fixed && pricedKg < 0.01 ? 0 : basePriceNgn(rates, pricedKg, input.distanceKm);
  const multiplier = input.serviceType ? rates.serviceMultipliers[input.serviceType as ServiceType] ?? 1 : 1;
  const service = base * multiplier;
  const addonsTotal = (input.addons ?? []).reduce((sum, key) => sum + (rates.addons[key]?.priceNgn ?? 0), 0);
  const usd = (n: number) => Math.round(n * rates.usdNgn * 100) / 100;
  const pickupFee = input.fulfillment === "pickup" ? (fixed ? usd(fixed.pickupUsd) : rates.pickupFeeNgn) : 0;
  const deliveryFee = fixed && input.homeDelivery ? usd(fixed.deliveryUsd) : 0;
  const fixedFreight = fixed ? usd(fixed.freightUsd) : 0;
  const packageCharges = input.packageCharges ?? 0;
  return {
    basePrice: base,
    serviceAdjustment: service - base,
    addonsTotal,
    pickupFee,
    deliveryFee,
    fixedFreight,
    packageCharges,
    finalPrice: service + addonsTotal + pickupFee + deliveryFee + fixedFreight + packageCharges,
  };
}

export function deliveryEstimate(serviceType: string, isDomestic: boolean) {
  const estimates: Record<string, [string, string]> = {
    air: ["1–2 days", "3–5 days"],
    land: ["2–4 days", "7–14 days"],
    ocean: ["3–5 days", "20–35 days"],
    door_to_door: ["1–3 days", "5–10 days"],
  };
  const e = estimates[serviceType];
  return e ? (isDomestic ? e[0] : e[1]) : "3–7 days";
}

// ---- Currency ----

/** Units of each currency per 1 NGN, refreshed at most hourly. */
export async function ngnRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/NGN", { next: { revalidate: 3600 } });
    const data = await res.json();
    return data?.rates ?? {};
  } catch {
    return {};
  }
}

export async function convertNgnTo(amountNgn: number, currency: string) {
  const code = currency.toUpperCase();
  if (code === "NGN") return amountNgn;
  const rates = await ngnRates();
  if (rates[code]) return amountNgn * rates[code];
  if (code === "USD") return amountNgn / 1600; // fixed fallback if the rate service is down
  return amountNgn;
}

// ---- Distance ("By Location" pricing) ----

export class LocationError extends Error {}

/**
 * Coordinates for a city — our own GeoNames-backed table first (fast, and
 * resolves exact names like "London (East Tempo)" that a general geocoder
 * can't), then OpenStreetMap's Nominatim as a fallback.
 */
export async function geocodeCity(city: string, country: string) {
  city = city.trim();
  country = country.trim();
  if (!city || !country) throw new LocationError("Please provide both a city and a country.");

  const [local] = await db
    .select({ lat: cities.lat, lng: cities.lng })
    .from(cities)
    .where(and(eq(cities.city, city), eq(cities.country, country), isNotNull(cities.lat)))
    .limit(1);
  if (local?.lat != null && local.lng != null) return { lat: Number(local.lat), lng: Number(local.lng) };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${city}, ${country}`)}`;
  let results: { lat: string; lon: string }[] = [];
  try {
    const res = await fetch(url, {
      // Nominatim's usage policy requires an identifying User-Agent; cache a month — places don't move.
      headers: { "User-Agent": "CoastalParcel/1.0 (https://coastalparcel.com)" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    results = await res.json();
  } catch {
    throw new LocationError("Could not look up that location right now. Please try again in a moment.");
  }
  if (!results.length) {
    throw new LocationError(`Could not find "${city}, ${country}" — please check the spelling, or use the manual distance option instead.`);
  }
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function locationDistanceKm(origin: { city: string; country: string }, dest: { city: string; country: string }) {
  const [a, b] = await Promise.all([geocodeCity(origin.city, origin.country), geocodeCity(dest.city, dest.country)]);
  return haversineKm(a, b);
}
