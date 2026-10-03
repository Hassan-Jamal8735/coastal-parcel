import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";

// City + postal-code autocomplete. Case-insensitive prefix match only, so the
// (country, lower(city) text_pattern_ops) index serves it in well under a millisecond.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = (searchParams.get("term") ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim();
  if (term.length < 2) return Response.json([]);

  const pattern = term.toLowerCase().replace(/[\%_]/g, (c) => "\\" + c) + "%";
  const cityMatches = sql`lower(${cities.city}) like ${pattern}`;
  const rows = await db
    .select({ city: cities.city, country: cities.country, postalCode: cities.postalCode })
    .from(cities)
    .where(country ? and(eq(cities.country, country), cityMatches) : cityMatches)
    .orderBy(asc(cities.city))
    .limit(10);

  return Response.json(rows, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
