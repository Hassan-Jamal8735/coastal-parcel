import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { shipments, trackingEvents, users } from "@/db/schema";
import { ACTIVE_DELIVERY_STATUSES, SITE_TIMEZONE } from "./constants";

export async function getShipmentByTracking(trackingNumber: string) {
  const code = trackingNumber.trim().toUpperCase();
  if (!code) return undefined;
  const [row] = await db.select().from(shipments).where(eq(shipments.trackingNumber, code)).limit(1);
  return row;
}

export async function getTrackingEvents(shipmentId: number) {
  return db
    .select({
      id: trackingEvents.id,
      status: trackingEvents.status,
      note: trackingEvents.note,
      lat: trackingEvents.lat,
      lng: trackingEvents.lng,
      createdAt: trackingEvents.createdAt,
      createdByName: users.name,
      createdByRole: users.role,
    })
    .from(trackingEvents)
    .leftJoin(users, eq(users.id, trackingEvents.createdBy))
    .where(eq(trackingEvents.shipmentId, shipmentId))
    .orderBy(asc(trackingEvents.createdAt), asc(trackingEvents.id));
}

/**
 * The driver's live position — only while a shipment is actually in
 * progress, and only if their last ping was within 10 minutes (an older
 * fix would be more misleading than useful).
 */
export async function getLiveDriverLocation(s: { driverId: number | null; status: string }, opts: { anyStatus?: boolean } = {}) {
  // Customers only see the driver mid-delivery; the office (anyStatus) sees them whenever they're sharing.
  if (!s.driverId || (!opts.anyStatus && !ACTIVE_DELIVERY_STATUSES.includes(s.status))) return null;
  const [d] = await db
    .select({ lat: users.lastLat, lng: users.lastLng, at: users.lastLocationAt, accuracy: users.lastAccuracyM })
    .from(users)
    .where(eq(users.id, s.driverId))
    .limit(1);
  if (!d?.lat || !d.lng || !d.at) return null;
  if (Date.now() - d.at.getTime() > 10 * 60 * 1000) return null;
  return { lat: Number(d.lat), lng: Number(d.lng), updatedAt: d.at, accuracy: d.accuracy };
}

/** Which of these drivers sent a live position in the last 10 minutes. */
export async function driversLiveNow(driverIds: number[]) {
  const ids = [...new Set(driverIds)];
  if (!ids.length) return new Set<number>();
  const rows = await db.select({ id: users.id, at: users.lastLocationAt }).from(users).where(inArray(users.id, ids));
  return new Set(rows.filter((r) => r.at && Date.now() - r.at.getTime() <= 10 * 60 * 1000).map((r) => r.id));
}

export function timeAgo(date: Date) {
  const s = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

export function formatDateTime(d: Date, withAt = true) {
  // Site time zone (as WordPress used), not the server's UTC.
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SITE_TIMEZONE });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE_TIMEZONE }).toLowerCase();
  return withAt ? `${date} at ${time}` : `${date} ${time}`;
}
