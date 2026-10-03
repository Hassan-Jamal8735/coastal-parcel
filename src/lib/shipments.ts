import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shipmentPackages, shipments, trackingEvents } from "@/db/schema";
import { getCurrentUser } from "./dal";

export type Shipment = typeof shipments.$inferSelect;
export type PackageInput = {
  description: string;
  weight: number;
  pieces: number;
  length: number | null;
  width: number | null;
  height: number | null;
};

// ---- Guest checkout ----
// A guest shipment has no customer_id; instead a random token is stored on
// the row and in a per-shipment httpOnly cookie, proving this browser
// created it. Guests only ever create an account after paying.

const guestCookie = (id: number) => `cp_gt_${id}`;

export function newGuestToken() {
  return randomBytes(24).toString("base64url");
}

export async function setGuestCookie(shipmentId: number, token: string) {
  (await cookies()).set(guestCookie(shipmentId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearGuestCookie(shipmentId: number) {
  (await cookies()).delete(guestCookie(shipmentId));
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Logged-in owner, or a guest holding the matching cookie for a guest shipment. */
export async function canAccessShipment(shipment: Shipment | undefined) {
  if (!shipment) return false;
  const user = await getCurrentUser();
  if (user && user.role === "customer" && shipment.customerId === user.id) return true;
  if (!shipment.customerId && shipment.guestToken) {
    const token = (await cookies()).get(guestCookie(shipment.id))?.value;
    if (token && safeEqual(token, shipment.guestToken)) return true;
  }
  return false;
}

export async function getShipment(id: number) {
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const [row] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  return row;
}

/**
 * Loads a shipment for one of the booking steps, or redirects. A guest
 * shipment that fails the cookie check almost always means the cookie is
 * gone (cleared, incognito, another device), so explain that rather than
 * bouncing to a login page with no context.
 */
export async function requireAccessibleShipment(id: number) {
  const shipment = await getShipment(id);
  if (!(await canAccessShipment(shipment))) {
    if (shipment && !shipment.customerId) redirect("/user-account-creation?tab=login&notice=guest_session_lost");
    redirect("/dashboard");
  }
  return shipment!;
}

export async function getPackages(shipmentId: number) {
  return db.select().from(shipmentPackages).where(eq(shipmentPackages.shipmentId, shipmentId)).orderBy(asc(shipmentPackages.sortOrder));
}

/** Totals kept on the shipment row (pricing only needs total weight). */
export function aggregatePackages(packages: PackageInput[]) {
  return {
    packageWeight: packages.reduce((sum, p) => sum + p.weight * p.pieces, 0),
    packagePieces: packages.reduce((sum, p) => sum + p.pieces, 0),
  };
}

export async function generateTrackingNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (;;) {
    const bytes = randomBytes(10);
    const candidate = "CP" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
    const [exists] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.trackingNumber, candidate)).limit(1);
    if (!exists) return candidate;
  }
}

export async function addTrackingEvent(
  shipmentId: number,
  status: string,
  note?: string | null,
  createdBy?: number | null,
  coords?: { lat: number; lng: number } | null,
) {
  await db.insert(trackingEvents).values({
    shipmentId,
    status,
    note: note || null,
    createdBy: createdBy ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });
}

/** Where a draft should resume, given how far through the wizard it got. */
export function nextStepFor(s: Shipment) {
  if (s.status === "draft") {
    if (!s.serviceType) return `/shipping-options?shipment_id=${s.id}`;
    return `/booking?shipment_id=${s.id}`;
  }
  if (s.status === "confirmed") return `/pay?shipment_id=${s.id}`;
  return `/booking-confirmed?shipment_id=${s.id}`;
}
