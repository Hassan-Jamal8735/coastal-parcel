import { COUNTRIES } from "@/lib/constants";

type NominatimReverse = {
  address?: Record<string, string>;
  error?: string;
};

/** Our country list's spelling for an OpenStreetMap result (names differ, e.g. "Côte d'Ivoire"). */
function matchCountry(name: string | undefined, code: string | undefined) {
  const list = COUNTRIES as readonly string[];
  if (name && list.includes(name)) return name;
  if (code) {
    const byCode = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase());
    if (byCode && list.includes(byCode)) return byCode;
  }
  return "";
}

/**
 * Turns a map pin into an address (street, city, postal code, country) via
 * OpenStreetMap, so pinning a spot fills the address fields for the customer.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid location." }, { status: 400 });
  }

  // ~11 m rounding: nearby taps share a cached answer, well inside an address's precision.
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  let data: NominatimReverse;
  try {
    const res = await fetch(url, {
      // Nominatim's usage policy requires an identifying User-Agent.
      headers: { "User-Agent": "CoastalParcel/1.0 (https://coastalparcel.com)" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    data = await res.json();
  } catch {
    return Response.json({ error: "Could not look up this address right now." }, { status: 502 });
  }
  const a = data.address;
  if (!a) return Response.json({ error: "No address found here — please type it in." }, { status: 404 });

  const street = [a.house_number, a.road ?? a.pedestrian ?? a.footway].filter(Boolean).join(" ");
  const area = a.neighbourhood ?? a.suburb ?? a.quarter;
  const address = [street, area].filter(Boolean).join(", ") || area || "";
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? "";

  return Response.json(
    { address, city, postalCode: a.postcode ?? "", country: matchCountry(a.country, a.country_code) },
    { headers: { "Cache-Control": "public, s-maxage=86400" } },
  );
}
