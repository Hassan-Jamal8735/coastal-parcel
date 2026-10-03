"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { homeFor } from "@/lib/dal";
import { createSession, deleteSession } from "@/lib/session";

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
  phone: z.string().trim().min(1, "Please fill in all fields."),
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

async function emailTaken(email: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows.length > 0;
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
  redirect(target ?? homeFor(user.role));
}

export async function signupCustomer(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(formData) };
  if (await emailTaken(parsed.data.email)) return { error: "An account with this email already exists.", values: keep(formData) };

  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "customer",
    })
    .returning({ id: users.id });

  await createSession(user.id, "customer");
  redirect(safeRedirect(formData.get("redirect_to")) ?? "/dashboard");
}

export async function signupDriver(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = driverSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(formData) };
  if (await emailTaken(parsed.data.email)) return { error: "An account with this email already exists.", values: keep(formData) };

  // New drivers start "pending" — staff approve them in the backoffice
  // before they can be assigned shipments.
  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      vehicleType: parsed.data.vehicle_type,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "driver",
      driverStatus: "pending",
    })
    .returning({ id: users.id });

  await createSession(user.id, "driver");
  redirect("/driver-dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
