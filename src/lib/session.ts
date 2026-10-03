import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt, SESSION_COOKIE, SESSION_MAX_AGE_DAYS, type Role } from "./session-token";

export type { Role } from "./session-token";

export async function createSession(userId: number, role: Role) {
  const expires = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const token = await encrypt({ userId, role, expiresAt: expires.toISOString() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}
