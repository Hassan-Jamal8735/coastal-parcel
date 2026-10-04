"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, homeFor } from "@/lib/dal";
import { sendDriverApplicationReceived, sendWelcomeCustomer } from "@/lib/email";
import { createSession, deleteSession } from "@/lib/session";
import { checkVerificationCode, issueVerificationCode, issueVerificationCodeIfDue, RESEND_COOLDOWN_SECONDS, resendWaitSeconds } from "@/lib/verification";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

export type AuthFormState = { error?: string; values?: Record<string, string> } | undefined;

/** The non-secret fields, echoed back on error so the form can be refilled (React resets forms after an action). */
function keep(formData: FormData) {
  const values: Record<string, string> = {};
  for (const k of ["full_name", "email", "phone", "vehicle_type"]) {
    const v = formData.get(k);
    if (typeof v === "string") values[k] = v.slice(0, 256);
  }
  return values;
}

const loginSchema = z.object({
  email: z.email("Please enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Please enter your email and password."),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Please fill in all fields."),
  email: z.email("Please enter a valid email address.").trim().toLowerCase(),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== null, PHONE_ERROR).transform((v) => normalizePhone(v)!),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const driverSignupSchema = signupSchema.extend({
  vehicle_type: z.enum(["motorcycle", "car", "van", "truck"], "Please fill in all fields."),
});

/** Only same-site relative paths — never redirect a user to another domain after login. */
function safeRedirect(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

type NewAccount = typeof users.$inferInsert;

/**
 * Creates an unverified account — or, if this email already has an account
 * that was never verified, takes it over (an unverified account proves
 * nothing, so it mustn't let anyone squat on an address). Returns null when
 * the email belongs to a verified account.
 */
async function createUnverifiedAccount(values: NewAccount) {
  const [existing] = await db.select({ id: users.id, verified: users.emailVerifiedAt }).from(users).where(eq(users.email, values.email)).limit(1);
  if (existing?.verified) return null;
  if (existing) {
    await db.update(users).set({ ...values, emailVerifiedAt: null }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(users).values(values).returning({ id: users.id });
  return created.id;
}

/** The verify page, flagged when the code email couldn't be sent so it can say so. */
function verifyUrl(redirectTo: string | null, sent = true) {
  const q = new URLSearchParams();
  if (redirectTo) q.set("redirect_to", redirectTo);
  if (!sent) q.set("send_failed", "1");
  return "/verify-email" + (q.size ? `?${q}` : "");
}

export async function login(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(formData) };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Same message for unknown email and wrong password, so the form can't be used to discover accounts.
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password.", values: keep(formData) };
  }

  await createSession(user.id, user.role);
  // Staff/drivers always go to their own area; customers may continue where they left off.
  const target = user.role === "customer" ? safeRedirect(formData.get("redirect_to")) : null;
  if (!user.emailVerifiedAt) {
    const sent = await issueVerificationCodeIfDue(user);
    redirect(verifyUrl(target, sent));
  }
  redirect(target ?? homeFor(user.role));
}

export async function signupCustomer(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(formData) };

  const values = {
    name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: "customer" as const,
    vehicleType: null,
    driverStatus: null,
  };
  const id = await createUnverifiedAccount(values);
  if (!id) return { error: "An account with this email already exists.", values: keep(formData) };

  const sent = await issueVerificationCode({ id, email: values.email, name: values.name });
  await createSession(id, "customer");
  redirect(verifyUrl(safeRedirect(formData.get("redirect_to")), sent));
}

export async function signupDriver(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = driverSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(formData) };

  // New drivers start "pending" — staff approve them in the backoffice
  // before they can be assigned shipments.
  const values = {
    name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    vehicleType: parsed.data.vehicle_type,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: "driver" as const,
    driverStatus: "pending" as const,
  };
  const id = await createUnverifiedAccount(values);
  if (!id) return { error: "An account with this email already exists.", values: keep(formData) };

  const sent = await issueVerificationCode({ id, email: values.email, name: values.name });
  await createSession(id, "driver");
  redirect(verifyUrl(null, sent));
}

/** `at` lets the page show whichever of verify/resend answered last. */
export type VerifyState = { error?: string; notice?: string; at: number; cooldown?: number } | undefined;

export async function verifyEmail(_: VerifyState, formData: FormData): Promise<VerifyState> {
  const user = await getSessionUser();
  if (!user) redirect("/user-account-creation?tab=login");
  if (user.emailVerifiedAt) redirect(homeFor(user.role));

  const result = await checkVerificationCode(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: result.error, at: Date.now() };

  // The welcome emails wait until the address is proven real.
  if (user.role === "driver") await sendDriverApplicationReceived(user);
  else if (user.role === "customer") await sendWelcomeCustomer(user);

  const target = user.role === "customer" ? safeRedirect(formData.get("redirect_to")) : null;
  redirect(target ?? homeFor(user.role));
}

export async function resendVerificationCode(): Promise<VerifyState> {
  const user = await getSessionUser();
  if (!user) redirect("/user-account-creation?tab=login");
  if (user.emailVerifiedAt) redirect(homeFor(user.role));

  const wait = await resendWaitSeconds(user.id);
  if (wait > 0) return { error: `Please wait ${wait} seconds before requesting another code.`, at: Date.now() };
  if (!(await issueVerificationCode(user))) {
    return { error: "We couldn't send the email right now. Please try again in a moment, or contact us if it keeps happening.", at: Date.now() };
  }
  return { notice: `A new code has been sent to ${user.email}.`, at: Date.now(), cooldown: RESEND_COOLDOWN_SECONDS };
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
