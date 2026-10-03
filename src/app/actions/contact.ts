"use server";

import * as z from "zod";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export type ContactState = { error?: string; success?: string; values?: Record<string, string> } | undefined;

/** Contact page submission (WordPress inc/contact-form.php): stored for the backoffice Messages panel, and emailed to the office. */
export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const field = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const name = field("full_name", 191);
  const email = field("email", 191).toLowerCase();
  const phone = field("phone", 50);
  const subject = field("subject", 191);
  const message = field("message", 5000);

  // Echo the input back so a rejected form can be refilled (React resets forms after an action).
  const values = { full_name: name, email, phone, subject, message };
  if (!name || !email || !message) return { error: "Please fill in your name, email, and message.", values };
  if (!z.email().safeParse(email).success) return { error: "Please enter a valid email address.", values };

  await db.insert(contactMessages).values({ name, email, phone: phone || null, subject: subject || null, message });
  await sendEmail(
    process.env.ADMIN_EMAIL ?? "Info@coastalparcel.com",
    `New contact message: ${subject || "No subject"}`,
    `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`,
  );

  return { success: "Thank you! Your message has been received — we'll get back to you soon." };
}
