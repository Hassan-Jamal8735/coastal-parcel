"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shipments, users } from "@/db/schema";
import { NEXT_DRIVER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { notifyCustomerStatusChange } from "@/lib/email";
import { uploadImage } from "@/lib/blob";
import { addTrackingEvent, getShipment } from "@/lib/shipments";
import { env } from "@/lib/env";

function fail(code: string): never {
  redirect(`/driver-dashboard?msg=${code}#shipments`);
}

function coord(v: FormDataEntryValue | null, limit: number) {
  const n = typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Driver self-service status update (WordPress inc/driver-actions.php):
 * one step forward at a time, or "failed". A photo is required to mark a
 * shipment delivered; the pickup photo is optional.
 */
export async function driverUpdateStatus(formData: FormData) {
  const driver = await requireRole("driver");
  if (driver.driverStatus !== "approved") fail("driver_not_found");

  const s = await getShipment(Number(formData.get("shipment_id")));
  if (!s || s.driverId !== driver.id) fail("driver_not_found");

  // Failing (like advancing) is only possible while the shipment is still in the driver's hands.
  if (!NEXT_DRIVER_STATUS[s.status]) fail("driver_cannot_advance");
  const next = formData.get("mark_failed") === "1" ? "failed" : NEXT_DRIVER_STATUS[s.status];

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (next === "delivered" && !hasPhoto) fail("driver_photo_required");

  const update: Partial<typeof shipments.$inferInsert> = { status: next, updatedAt: new Date() };
  if (hasPhoto && (next === "picked_up" || next === "delivered")) {
    try {
      const url = await uploadImage(photo, `shipments/${s.id}`);
      if (next === "picked_up") update.pickupPhotoUrl = url;
      else update.deliveryPhotoUrl = url;
    } catch {
      // A failed pickup photo is not a blocker; a failed proof of delivery is.
      if (next === "delivered") fail(env("BLOB_READ_WRITE_TOKEN") ? "driver_upload_failed" : "driver_upload_unconfigured");
    }
  }

  await db.update(shipments).set(update).where(eq(shipments.id, s.id));

  const lat = coord(formData.get("lat"), 90);
  const lng = coord(formData.get("lng"), 180);
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const acc = coord(formData.get("accuracy"), 100000);
  const coords = lat !== null && lng !== null ? { lat, lng, accuracy: acc !== null ? Math.round(acc) : null } : null;
  await addTrackingEvent(s.id, next, note, driver.id, coords);
  // The update's fix is also the driver's freshest live position.
  if (coords) await db.update(users).set({ lastLat: coords.lat, lastLng: coords.lng, lastAccuracyM: coords.accuracy, lastLocationAt: new Date() }).where(eq(users.id, driver.id));
  await notifyCustomerStatusChange({ ...s, ...update } as typeof s, next);

  redirect("/driver-dashboard#shipments");
}
