import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { formatMoney, serviceLabel, statusLabel } from "./constants";
import { renderEmail, SITE, type EmailContent } from "./email-template";
import type { Shipment } from "./shipments";

type Message = { to: string; subject: string; content: EmailContent; replyTo?: string };

/**
 * Sends a branded email: through Resend when RESEND_API_KEY is set,
 * otherwise over SMTP (MAIL_* variables), otherwise it just logs — so
 * nothing else in the app breaks while email isn't connected. Delivery
 * happens after the response is sent, so nobody waits on a mail server.
 * Failures are logged, never thrown — an email problem must never block a
 * payment or status update.
 */
export async function sendEmail(message: Message) {
  try {
    after(() => deliver(message));
  } catch {
    // Outside a request (e.g. a script) there's no response to wait for.
    await deliver(message);
  }
}

/** Which way email is sent right now — shown in the backoffice so a missing key is obvious. */
export function emailProvider(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) return "smtp";
  return null;
}

/** Sends now and reports whether it worked — returns false on any failure or when email isn't configured. */
async function deliver({ to, subject, content, replyTo }: Message): Promise<boolean> {
  const { html, text } = renderEmail(content);
  const key = process.env.RESEND_API_KEY;
  try {
    if (key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Coastal Parcel <noreply@coastalparcel.com>",
          to,
          subject,
          html,
          text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (!res.ok) {
        console.error("Email send failed (Resend)", res.status, await res.text());
        return false;
      }
      return true;
    } else if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.MAIL_PORT ?? 587);
      const transport = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port,
        secure: port === 465, // 587 upgrades to TLS via STARTTLS
        auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
      });
      const from = process.env.MAIL_FROM_ADDRESS ?? process.env.MAIL_USERNAME;
      await transport.sendMail({ from: `Coastal Parcel <${from}>`, to, subject, html, text, replyTo });
      return true;
    } else {
      console.error(`[email not configured — set RESEND_API_KEY] to=${to} subject="${subject}"`);
      return false;
    }
  } catch (e) {
    console.error("Email send failed", e);
    return false;
  }
}

/* ---------------- Shipment emails ---------------- */

/** Email + display name for a shipment's owner — the account, or the guest's own details. */
async function shipmentContact(s: Shipment) {
  if (s.customerId) {
    const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, s.customerId)).limit(1);
    if (u) return u;
  }
  return s.senderEmail ? { email: s.senderEmail, name: s.senderName } : null;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const route = (s: Shipment) => `${s.pickupCity}, ${s.pickupCountry} → ${s.deliveryCity}, ${s.deliveryCountry}`;
const trackUrl = (s: Shipment) => `${SITE}/track-shipment?tracking=${encodeURIComponent(s.trackingNumber ?? "")}`;

/** Per-status wording for the customer update email. */
function statusCopy(status: string, s: Shipment): { subject: string; heading: string; intro: string; outro?: string } {
  const ref = s.trackingNumber ?? `#${s.id}`;
  switch (status) {
    case "paid":
      return {
        subject: `Booking confirmed — tracking number ${ref}`,
        heading: "Your booking is confirmed",
        intro: "We've received your payment and your shipment is booked. Keep your tracking number handy — you can follow every step of the journey online.",
        outro: "We'll email you again as soon as a driver picks up your parcel.",
      };
    case "assigned":
      return { subject: `A driver has been assigned — ${ref}`, heading: "A driver is on the way", intro: "A Coastal Parcel driver has been assigned to your shipment and will collect it from the pickup address shortly." };
    case "picked_up":
      return { subject: `Your parcel has been picked up — ${ref}`, heading: "Your parcel has been picked up", intro: "Our driver has collected your parcel. It's now in our care and heading on its way." };
    case "in_transit":
      return { subject: `Your parcel is in transit — ${ref}`, heading: "Your parcel is in transit", intro: "Your parcel is on the move towards its destination." };
    case "out_for_delivery":
      return {
        subject: `Out for delivery today — ${ref}`,
        heading: "Your parcel is out for delivery",
        intro: "Good news — your parcel is out for delivery. Please make sure someone is available to receive it.",
      };
    case "delivered":
      return {
        subject: `Delivered — ${ref}`,
        heading: "Your parcel has been delivered",
        intro: "Your parcel has been delivered. Thank you for shipping with Coastal Parcel!",
        outro: s.deliveryPhotoUrl ? `Proof of delivery photo: ${s.deliveryPhotoUrl}` : undefined,
      };
    case "failed":
      return {
        subject: `Delivery attempt unsuccessful — ${ref}`,
        heading: "We couldn't complete the delivery",
        intro: "Our driver wasn't able to complete the delivery of your parcel. Our team will be in touch to arrange the next attempt.",
        outro: "If you'd like to sort it out sooner, reply to us on WhatsApp or by email using the details below.",
      };
    case "cancelled":
      return { subject: `Shipment cancelled — ${ref}`, heading: "Your shipment has been cancelled", intro: "Your shipment has been cancelled. If you didn't expect this, please contact us." };
    case "returned":
      return { subject: `Shipment returned — ${ref}`, heading: "Your shipment has been returned", intro: "Your shipment has been returned to the sender. Please contact us if you have any questions." };
    default:
      return { subject: `Shipment update: ${statusLabel(status)} — ${ref}`, heading: "Your shipment has been updated", intro: `Your shipment's status is now: ${statusLabel(status)}.` };
  }
}

export async function notifyCustomerStatusChange(s: Shipment, status: string) {
  const contact = await shipmentContact(s);
  if (!contact) return;
  const copy = statusCopy(status, s);

  const details: [string, string][] = [];
  if (s.trackingNumber) details.push(["Tracking number", s.trackingNumber]);
  details.push(["Route", route(s)], ["Status", statusLabel(status)]);
  if (s.serviceType) details.push(["Service", serviceLabel(s.serviceType)]);
  details.push(["Weight", `${s.packageWeight} kg${s.packagePieces > 1 ? ` · ${s.packagePieces} pieces` : ""}`]);
  if (status === "paid") {
    const paid = s.chargeCurrency && s.chargeAmount ? formatMoney(s.chargeAmount, s.chargeCurrency) : formatMoney(s.priceAmount, "NGN");
    details.push(["Amount paid", paid]);
    if (s.paymentReference) details.push(["Payment reference", s.paymentReference]);
    details.push(["Receiver", `${s.receiverName}\n${s.deliveryAddress}, ${s.deliveryCity}`]);
  }

  await sendEmail({
    to: contact.email,
    subject: `${copy.subject}`,
    content: {
      preheader: copy.intro,
      heading: copy.heading,
      intro: [`Hi ${firstName(contact.name)},`, copy.intro],
      details,
      button: s.trackingNumber ? { label: "Track your shipment", url: trackUrl(s) } : undefined,
      outro: copy.outro ? [copy.outro] : undefined,
    },
  });
}

export async function notifyDriverAssigned(s: Shipment, driver: { email: string; name: string }) {
  await sendEmail({
    to: driver.email,
    subject: `New shipment assigned — ${s.pickupCity} → ${s.deliveryCity}`,
    content: {
      preheader: `Pickup in ${s.pickupCity}, delivery to ${s.deliveryCity}.`,
      heading: "New shipment assigned to you",
      intro: [`Hi ${firstName(driver.name)},`, "A new shipment has been assigned to you. Here are the details:"],
      details: [
        ["Reference", s.trackingNumber ?? `#${s.id}`],
        ["Pickup from", `${s.senderName} (${s.senderPhone})\n${s.pickupAddress}, ${s.pickupCity}, ${s.pickupCountry}`],
        ["Deliver to", `${s.receiverName} (${s.receiverPhone})\n${s.deliveryAddress}, ${s.deliveryCity}, ${s.deliveryCountry}`],
        ["Weight", `${s.packageWeight} kg${s.packagePieces > 1 ? ` · ${s.packagePieces} pieces` : ""}`],
        ...(s.notes ? ([["Customer note", s.notes]] as [string, string][]) : []),
      ],
      button: { label: "Open driver dashboard", url: `${SITE}/driver-dashboard#shipments` },
      outro: ["Remember: a photo of the delivered parcel is required to mark it as delivered."],
    },
  });
}

/* ---------------- Account emails ---------------- */

/** Sent immediately (not after the response) so the page can say whether the code really went out. */
export async function sendVerificationCode(user: { email: string; name: string }, code: string): Promise<boolean> {
  return deliver({
    to: user.email,
    subject: `Your verification code: ${code}`,
    content: {
      preheader: `Your code is ${code}. It expires in 15 minutes.`,
      heading: "Verify your email address",
      intro: [`Hi ${firstName(user.name)},`, "Enter this code on the Coastal Parcel website to verify your email address:"],
      code,
      outro: ["The code expires in 15 minutes. If you didn't create a Coastal Parcel account, you can safely ignore this email."],
    },
  });
}

export async function sendWelcomeCustomer(user: { email: string; name: string }) {
  await sendEmail({
    to: user.email,
    subject: "Welcome to Coastal Parcel",
    content: {
      preheader: "Your account is ready — book and track shipments anytime.",
      heading: "Welcome to Coastal Parcel",
      intro: [
        `Hi ${firstName(user.name)},`,
        "Your account is ready. You can now get instant quotes, book shipments by air, land or ocean, and track every parcel from your dashboard.",
      ],
      button: { label: "Create your first shipment", url: `${SITE}/ship` },
    },
  });
}

export async function sendDriverApplicationReceived(user: { email: string; name: string }) {
  await sendEmail({
    to: user.email,
    subject: "We've received your driver application",
    content: {
      preheader: "Your application is under review.",
      heading: "Thanks for applying",
      intro: [
        `Hi ${firstName(user.name)},`,
        "Thanks for applying to deliver with Coastal Parcel. Our team is reviewing your application and we'll email you as soon as a decision is made.",
      ],
      button: { label: "View your driver account", url: `${SITE}/driver-dashboard` },
    },
  });
}

export async function sendDriverDecision(user: { email: string; name: string }, status: "approved" | "rejected" | "pending") {
  if (status === "pending") return;
  const approved = status === "approved";
  await sendEmail({
    to: user.email,
    subject: approved ? "Your driver application is approved" : "Update on your driver application",
    content: {
      preheader: approved ? "You can now receive shipments." : "An update on your application.",
      heading: approved ? "You're approved!" : "Application update",
      intro: approved
        ? [`Hi ${firstName(user.name)},`, "Great news — your driver application has been approved. Shipments assigned to you will now appear in your driver dashboard, and we'll email you each time one is assigned."]
        : [`Hi ${firstName(user.name)},`, "Thank you for your interest in delivering with Coastal Parcel. Unfortunately we're unable to approve your application at this time.", "If you believe this is a mistake, please contact us."],
      button: approved ? { label: "Open driver dashboard", url: `${SITE}/driver-dashboard` } : undefined,
    },
  });
}

export async function sendStaffAccountCreated(user: { email: string; name: string }) {
  await sendEmail({
    to: user.email,
    subject: "Your back office account",
    content: {
      preheader: "You now have access to the Coastal Parcel back office.",
      heading: "Your back office account is ready",
      intro: [
        `Hi ${firstName(user.name)},`,
        "A Coastal Parcel back office account has been created for you. Log in with this email address and the password your administrator gave you.",
      ],
      button: { label: "Log in", url: `${SITE}/user-account-creation?tab=login` },
    },
  });
}

/* ---------------- Contact form ---------------- */

export async function notifyContactMessage(m: { name: string; email: string; phone: string; subject: string; message: string }) {
  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? "Info@coastalparcel.com",
    replyTo: m.email,
    subject: `New contact message: ${m.subject || "No subject"}`,
    content: {
      preheader: `${m.name}: ${m.message.slice(0, 90)}`,
      heading: "New contact message",
      intro: ["Someone sent a message through the website's Contact page. Reply to this email to answer them directly."],
      details: [
        ["Name", m.name],
        ["Email", m.email],
        ["Phone", m.phone || "—"],
        ["Subject", m.subject || "—"],
        ["Message", m.message],
      ],
      button: { label: "Open Messages", url: `${SITE}/backoffice?panel=messages` },
    },
  });

  await sendEmail({
    to: m.email,
    subject: "We've received your message",
    content: {
      preheader: "Thanks for reaching out — we'll get back to you soon.",
      heading: "We've received your message",
      intro: [`Hi ${firstName(m.name)},`, "Thanks for getting in touch. Our team has received your message and will get back to you shortly."],
      details: [["Your message", m.message]],
      outro: ["For anything urgent, reach us on WhatsApp using the number below."],
    },
  });
}
