import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { statusLabel } from "./constants";
import type { Shipment } from "./shipments";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://coastalparcel.com";

/**
 * Sends a plain-text email: through Resend when RESEND_API_KEY is set,
 * otherwise over SMTP (MAIL_* variables), otherwise it just logs — so
 * nothing else in the app breaks while email isn't connected. Failures are
 * logged, never thrown — an email problem must never block a payment or
 * status update.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  // Deliver after the response is sent, so nobody waits on a mail server
  // (SMTP can take several seconds). Outside a request (scripts), send inline.
  try {
    after(() => deliver(to, subject, text));
  } catch {
    await deliver(to, subject, text);
  }
}

async function deliver(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) return sendSmtp(to, subject, text);
    console.info(`[email not configured] to=${to} subject="${subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Coastal Parcel <noreply@coastalparcel.com>", to, subject, text }),
    });
    if (!res.ok) console.error("Email send failed", res.status, await res.text());
  } catch (e) {
    console.error("Email send failed", e);
  }
}

async function sendSmtp(to: string, subject: string, text: string) {
  try {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.MAIL_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port,
      secure: port === 465, // 587 upgrades to TLS via STARTTLS
      auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
    });
    const from = process.env.MAIL_FROM_ADDRESS ?? process.env.MAIL_USERNAME;
    await transport.sendMail({ from: `Coastal Parcel <${from}>`, to, subject, text });
  } catch (e) {
    console.error("Email send failed (SMTP)", e);
  }
}

/** Email + display name for a shipment's owner — the account, or the guest's own details. */
async function shipmentContact(s: Shipment) {
  if (s.customerId) {
    const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, s.customerId)).limit(1);
    if (u) return u;
  }
  return s.senderEmail ? { email: s.senderEmail, name: s.senderName } : null;
}

export async function notifyCustomerStatusChange(s: Shipment, status: string) {
  const contact = await shipmentContact(s);
  if (!contact) return;
  let body = `Hi ${contact.name},\n\nYour shipment from ${s.pickupCity} to ${s.deliveryCity} is now: ${statusLabel(status)}.\n\n`;
  if (s.trackingNumber) {
    body += `Tracking number: ${s.trackingNumber}\nTrack it here: ${SITE}/track-shipment?tracking=${s.trackingNumber}\n\n`;
  }
  body += "Thanks,\nCoastal Parcel";
  await sendEmail(contact.email, `[Coastal Parcel] Shipment ${s.trackingNumber ?? "#" + s.id}: ${statusLabel(status)}`, body);
}

export async function notifyDriverAssigned(s: Shipment, driver: { email: string; name: string }) {
  await sendEmail(
    driver.email,
    "[Coastal Parcel] New shipment assigned to you",
    `Hi ${driver.name},\n\nA shipment has been assigned to you:\nPickup: ${s.pickupAddress}, ${s.pickupCity}\nDelivery: ${s.deliveryAddress}, ${s.deliveryCity}\n\nView it in your driver dashboard: ${SITE}/driver-dashboard#shipments`,
  );
}
