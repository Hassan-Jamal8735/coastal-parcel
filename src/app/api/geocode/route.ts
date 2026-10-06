import { geocodeCity, LocationError } from "@/lib/pricing";

// City centre for the map pin picker to open on (local cities table first, then OpenStreetMap).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const point = await geocodeCity(searchParams.get("city") ?? "", searchParams.get("country") ?? "");
    return Response.json(point, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    if (e instanceof LocationError) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
