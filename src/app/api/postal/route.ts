import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";

/**
 * Postal code → city, so typing a postal code fills the city field. Our own
 * cities table first (it holds postal codes for many countries), then
 * OpenStreetMap.
 */
/** ISO 3166 code for a country name from our list ("United Kingdom" → "gb"), so lookups stay inside it. */
function isoCode(country: string) {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      const code = String.fromCharCode(i, j);
      try {
        if (names.of(code) === country) return code.toLowerCase();
      } catch {}
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim();
  if (code.length < 2 || !country) return Response.json({ city: null });

  const [local] = await db
    .select({ city: cities.city })
    .from(cities)
    .where(and(eq(cities.country, country), sql`upper(replace(${cities.postalCode}, ' ', '')) = ${code.toUpperCase().replace(/\s/g, "")}`))
    .limit(1);
  if (local) return Response.json({ city: local.city }, { headers: { "Cache-Control": "public, s-maxage=86400" } });

  try {
    // Structured search first; UK/Canadian-style codes often only match as free text.
    const iso = isoCode(country);
    const base = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=en${iso ? `&countrycodes=${iso}` : ""}`;
    for (const query of [`postalcode=${encodeURIComponent(code)}&country=${encodeURIComponent(country)}`, `q=${encodeURIComponent(`${code}, ${country}`)}`]) {
      const res = await fetch(`${base}&${query}`, {
        headers: { "User-Agent": "CoastalParcel/1.0 (https://coastalparcel.com)" },
        next: { revalidate: 60 * 60 * 24 * 30 },
      });
      const [hit] = (await res.json()) as { address?: Record<string, string> }[];
      const a = hit?.address;
      if (iso && a?.country_code && a.country_code !== iso) continue;
      // Only trust a hit whose own postal code matches what was typed (at least its first 3 characters);
      // otherwise leave the city for the customer rather than fill in a wrong one.
      const norm = (v: string) => v.toUpperCase().replace(/\s/g, "");
      if (!a?.postcode || !norm(a.postcode).startsWith(norm(code).slice(0, 3))) continue;
      const city = a ? (a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? null) : null;
      if (city) return Response.json({ city }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
    }
    return Response.json({ city: null });
  } catch {
    return Response.json({ city: null });
  }
}
