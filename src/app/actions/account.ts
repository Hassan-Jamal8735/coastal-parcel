"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { addTrackingEvent, getShipment } from "@/lib/shipments";
import { issueVerificationCode } from "@/lib/verification";
import { normalizePhone } from "@/lib/phone";

/** Profile + password updates shared by the customer and driver dashboards (WordPress inc/dashboard.php). */

function back(home: string, panel: string, key: string) {
  redirect(`${home}?msg=${key}#${panel}`);
}

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/user-account-creation?tab=login");
  const home = homeFor(user.role);

  const name = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  if (phone === null) back(home, "profile", "profile_phone_invalid");
  if (!name || !emailRaw) back(home, "profile", "profile_required");
  if (!z.email().safeParse(emailRaw).success) back(home, "profile", "profile_email_invalid");

  const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, emailRaw), ne(users.id, user.id))).limit(1);
  if (taken) back(home, "profile", "profile_email_taken");

  const vehicle = formData.get("vehicle_type");
  // A new address has to be proven like the original one was.
  const emailChanged = emailRaw !== user.email;
  await db
    .update(users)
    .set({
      name: name.slice(0, 191),
      email: emailRaw,
      phone: phone || null,
      ...(user.role === "driver" && typeof vehicle === "string" && vehicle ? { vehicleType: vehicle.slice(0, 50) } : {}),
      ...(emailChanged ? { emailVerifiedAt: null } : {}),
    })
    .where(eq(users.id, user.id));
  if (emailChanged) {
    const sent = await issueVerificationCode({ id: user.id, email: emailRaw, name });
    redirect(sent ? "/verify-email" : "/verify-email?send_failed=1");
  }
  back(home, "profile", "profile_saved");
}

export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/user-account-creation?tab=login");
  const home = homeFor(user.role);

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await bcrypt.compare(current, row.hash))) back(home, "settings", "password_wrong");
  if (next.length < 8) back(home, "settings", "password_short");
  if (next !== confirm) back(home, "settings", "password_mismatch");

  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, user.id));
  back(home, "settings", "password_saved");
}

/** Customer note on one of their own shipments — logged as a tracking event. */
export async function addCustomerNote(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") redirect("/user-account-creation?tab=login");

  const shipment = await getShipment(Number(formData.get("shipment_id")));
  if (!shipment || shipment.customerId !== user.id) back("/dashboard", "shipments", "note_denied");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) back("/dashboard", "shipments", "note_empty");

  await addTrackingEvent(shipment!.id, shipment!.status, note.slice(0, 2000), user.id);
  back("/dashboard", "shipments", "note_saved");
}
