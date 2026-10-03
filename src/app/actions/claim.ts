"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shipments, users } from "@/db/schema";
import { createSession } from "@/lib/session";
import { canAccessShipment, clearGuestCookie, getShipment } from "@/lib/shipments";
import { issueVerificationCode, issueVerificationCodeIfDue } from "@/lib/verification";

export type ClaimState = { error?: string } | undefined;

/**
 * The guest checkout's one signup touchpoint, offered (never forced) after
 * payment: creates a customer account — or signs into an existing one — and
 * moves this guest shipment onto it.
 */
export async function claimGuestShipment(id: number, _: ClaimState, formData: FormData): Promise<ClaimState> {
  const s = await getShipment(id);
  if (!s || s.customerId || !(await canAccessShipment(s))) return { error: "This shipment can no longer be claimed." };

  const name = String(formData.get("full_name") ?? s.senderName).trim();
  const email = String(formData.get("email") ?? s.senderEmail ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !password) return { error: "Please fill in all fields." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId: number;
  let verified = false;
  let sent = true;
  if (existing) {
    // The email may belong to a driver/staff/admin account — signing that in
    // and handing it a customer shipment would mix up roles and data.
    if (existing.role !== "customer") {
      return { error: "This email is already used by a different kind of account. Please use a different email address to create your customer account." };
    }
    if (!(await bcrypt.compare(password, existing.passwordHash))) {
      return { error: "An account with this email already exists — enter its password to claim this shipment, or skip for now." };
    }
    userId = existing.id;
    verified = Boolean(existing.emailVerifiedAt);
    if (!verified) sent = await issueVerificationCodeIfDue({ id: userId, email, name: existing.name });
  } else {
    const [created] = await db
      .insert(users)
      .values({ name, email, phone: s.senderPhone, passwordHash: await bcrypt.hash(password, 10), role: "customer" })
      .returning({ id: users.id });
    userId = created.id;
    sent = await issueVerificationCode({ id: userId, email, name });
  }

  await db.update(shipments).set({ customerId: userId, guestToken: null, updatedAt: new Date() }).where(eq(shipments.id, id));
  await clearGuestCookie(id);
  await createSession(userId, "customer");
  // A new account proves its email before it's usable; the shipment is
  // already linked, and verification lands them back on this confirmation.
  const back = `/booking-confirmed?shipment_id=${id}`;
  redirect(verified ? back : `/verify-email?redirect_to=${encodeURIComponent(back)}${sent ? "" : "&send_failed=1"}`);
}
