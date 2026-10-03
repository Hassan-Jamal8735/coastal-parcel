import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

/**
 * Live driver location ping (WordPress cp_driver_ping_location). The driver
 * dashboard calls this every ~25s while they have an active shipment; the
 * tracking page and backoffice map read it back as the "live" dot.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "driver") return NextResponse.json({ success: false }, { status: 403 });

  const body = await request.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ success: false }, { status: 400 });

  await db.update(users).set({ lastLat: lat, lastLng: lng, lastLocationAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ success: true });
}
