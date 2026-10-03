import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { sendVerificationCode } from "./email";

/**
 * Email verification by 6-digit code. Only a keyed hash of the code is
 * stored; a code lasts 15 minutes and allows 5 wrong guesses, after which a
 * new one has to be sent (at most one send per minute).
 */

const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_SECONDS * 1000;
export const MAX_ATTEMPTS = 5;

function hashCode(userId: number, code: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${userId}:${code}`).digest("hex");
}

/** Seconds until another code may be sent (0 = now). */
export async function resendWaitSeconds(userId: number) {
  const [row] = await db.select({ sentAt: emailVerifications.sentAt }).from(emailVerifications).where(eq(emailVerifications.userId, userId)).limit(1);
  if (!row) return 0;
  return Math.max(0, Math.ceil((row.sentAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000));
}

/**
 * Creates a fresh code (replacing any previous one) and emails it. Returns
 * whether the email went out; if it didn't, the resend cooldown is lifted so
 * the user can try again straight away.
 */
export async function issueVerificationCode(user: { id: number; email: string; name: string }): Promise<boolean> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = { codeHash: hashCode(user.id, code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), sentAt: new Date() };
  await db
    .insert(emailVerifications)
    .values({ userId: user.id, ...row })
    .onConflictDoUpdate({ target: emailVerifications.userId, set: row });
  const sent = await sendVerificationCode(user, code);
  if (!sent) {
    await db
      .update(emailVerifications)
      .set({ sentAt: new Date(Date.now() - RESEND_COOLDOWN_MS) })
      .where(eq(emailVerifications.userId, user.id));
  }
  return sent;
}

/** Sends a code unless one was sent within the cooldown (e.g. on repeated logins). */
export async function issueVerificationCodeIfDue(user: { id: number; email: string; name: string }) {
  if ((await resendWaitSeconds(user.id)) === 0) return issueVerificationCode(user);
  return true;
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function checkVerificationCode(userId: number, input: string): Promise<VerifyResult> {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Please enter the 6-digit code from the email." };

  const [row] = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, userId)).limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: "This code has expired. Please request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts. Please request a new code." };

  const stored = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(userId, code), "hex");
  const match = stored.length === given.length && timingSafeEqual(stored, given);
  if (!match) {
    await db.update(emailVerifications).set({ attempts: row.attempts + 1 }).where(eq(emailVerifications.userId, userId));
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return {
      ok: false,
      error: left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Please request a new code.",
    };
  }

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
  return { ok: true };
}
