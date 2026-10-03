"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { contactMessages, settings, shipments, trackingEvents, users } from "@/db/schema";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { notifyCustomerStatusChange, notifyDriverAssigned, sendDriverDecision, sendStaffAccountCreated } from "@/lib/email";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { addTrackingEvent, getShipment } from "@/lib/shipments";

/** Backoffice form handlers (WordPress inc/backoffice.php). Every one re-checks the staff/admin role. */

const requireStaff = () => requireRole("staff", "admin");

export async function boSaveShipment(formData: FormData) {
  const actor = await requireStaff();
  const id = Number(formData.get("shipment_id"));
  const existing = await getShipment(id);
  if (!existing) redirect("/backoffice?panel=shipments");

  let status = String(formData.get("status") ?? "");
  if (!(status in SHIPMENT_STATUS_LABELS)) status = existing.status;
  const driverId = Number(formData.get("driver_id")) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  let driver: { id: number; name: string; email: string } | undefined;
  if (driverId) {
    [driver] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, driverId), eq(users.role, "driver"), eq(users.driverStatus, "approved")))
      .limit(1);
    if (!driver) redirect(`/backoffice?panel=shipments&view=${id}`);
  }

  // A newly-assigned driver can only act from "assigned" onward, so bump a
  // pre-assignment status — otherwise the shipment sits with no button for them.
  const isNewDriver = Boolean(driver) && existing.driverId !== driverId;
  if (isNewDriver && ["draft", "confirmed", "paid"].includes(status)) status = "assigned";

  await db.update(shipments).set({ status, driverId, updatedAt: new Date() }).where(eq(shipments.id, id));

  if (status !== existing.status) {
    await addTrackingEvent(id, status, note || "Status updated via backoffice.", actor.id);
    await notifyCustomerStatusChange({ ...existing, status }, status);
  } else if (note) {
    await addTrackingEvent(id, existing.status, note, actor.id);
  }
  if (isNewDriver && driver) {
    await addTrackingEvent(id, status, `Assigned to driver: ${driver.name}`, actor.id);
    await notifyDriverAssigned({ ...existing, status, driverId }, driver);
  }

  redirect(`/backoffice?panel=shipments&view=${id}&saved=1`);
}

export async function boSetDriverStatus(formData: FormData) {
  await requireStaff();
  const status = String(formData.get("driver_status") ?? "");
  if (status === "approved" || status === "rejected" || status === "pending") {
    const [driver] = await db
      .select({ id: users.id, email: users.email, name: users.name, driverStatus: users.driverStatus })
      .from(users)
      .where(and(eq(users.id, Number(formData.get("driver_id"))), eq(users.role, "driver")))
      .limit(1);
    if (driver && driver.driverStatus !== status) {
      await db.update(users).set({ driverStatus: status }).where(eq(users.id, driver.id));
      await sendDriverDecision(driver, status);
    }
  }
  redirect("/backoffice?panel=drivers&saved=1");
}

export async function boSavePricing(formData: FormData) {
  await requireStaff();
  const num = (key: string, fallback: number) => {
    const n = Number(formData.get(key));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const [row] = await db.select().from(settings).where(eq(settings.key, "pricing")).limit(1);
  const value = {
    ...((row?.value as object) ?? {}),
    ratePerKmNgn: num("rate_per_km_ngn", DEFAULT_PRICING.ratePerKmNgn),
    ratePerKgNgn: num("rate_per_kg_ngn", DEFAULT_PRICING.ratePerKgNgn),
    pickupFeeNgn: num("pickup_fee_ngn", DEFAULT_PRICING.pickupFeeNgn),
  };
  await db
    .insert(settings)
    .values({ key: "pricing", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  redirect("/backoffice?panel=pricing&saved=1");
}

export async function boMarkMessageRead(formData: FormData) {
  await requireStaff();
  await db.update(contactMessages).set({ status: "read" }).where(eq(contactMessages.id, Number(formData.get("message_id"))));
  redirect("/backoffice?panel=messages");
}

const staffSchema = z.object({
  full_name: z.string().trim().min(1, "Please fill in all fields."),
  email: z.email("Please enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const STAFF_ERRORS: Record<string, string> = {
  "Please fill in all fields.": "fields",
  "Please enter a valid email address.": "email",
  "Password must be at least 8 characters.": "password",
};

export async function boCreateStaff(formData: FormData) {
  await requireStaff();
  const raw = Object.fromEntries(["full_name", "email", "password"].map((k) => [k, String(formData.get(k) ?? "")]));
  if (!raw.full_name || !raw.email || !raw.password) redirect("/backoffice?panel=staff&error=fields");
  const parsed = staffSchema.safeParse(raw);
  if (!parsed.success) redirect(`/backoffice?panel=staff&error=${STAFF_ERRORS[parsed.error.issues[0].message] ?? "fields"}`);

  const { full_name, email, password } = parsed.data;
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (taken) redirect("/backoffice?panel=staff&error=exists");

  await db.insert(users).values({ name: full_name.slice(0, 191), email, passwordHash: await bcrypt.hash(password, 10), role: "staff" });
  await sendStaffAccountCreated({ email, name: full_name });
  redirect("/backoffice?panel=staff&saved=1");
}

export async function boRemoveStaff(formData: FormData) {
  const actor = await requireStaff();
  const staffId = Number(formData.get("staff_id"));
  if (staffId === actor.id) redirect("/backoffice?panel=staff&error=self");

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, staffId)).limit(1);
  if (target?.role === "staff") {
    // Keep their timeline entries (shown as "System"), just detach them.
    await db.update(trackingEvents).set({ createdBy: null }).where(eq(trackingEvents.createdBy, staffId));
    await db.delete(users).where(eq(users.id, staffId));
  }
  redirect("/backoffice?panel=staff&saved=1");
}
