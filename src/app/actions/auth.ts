"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { homeFor } from "@/lib/dal";
import { createSession, deleteSession } from "@/lib/session";

export type AuthFormState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Please enter your password."),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  phone: z.string().trim().min(5, "Please enter your phone number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const driverSignupSchema = signupSchema.extend({
  vehicleType: z.string().trim().min(2, "Please choose your vehicle type."),
});

/** Only same-site relative paths — never redirect a user to another domain after login. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function login(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Same message for unknown email and wrong password, so the form can't be used to discover accounts.
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id, user.role);
  redirect(safeNext(formData.get("next")) ?? homeFor(user.role));
}

export async function signupCustomer(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length) return { error: "An account with this email already exists." };

  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "customer",
    })
    .returning({ id: users.id });

  await createSession(user.id, "customer");
  redirect(safeNext(formData.get("next")) ?? "/dashboard");
}

export async function signupDriver(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = driverSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length) return { error: "An account with this email already exists." };

  // New drivers start "pending" — staff approve them in the backoffice before
  // they can be assigned shipments.
  const [user] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      vehicleType: parsed.data.vehicleType,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "driver",
      driverStatus: "pending",
    })
    .returning({ id: users.id });

  await createSession(user.id, "driver");
  redirect("/driver");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
