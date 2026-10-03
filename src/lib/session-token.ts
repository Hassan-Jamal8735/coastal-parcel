import { SignJWT, jwtVerify } from "jose";

// Pure token helpers (no next/headers) so proxy.ts can verify sessions too.
export type Role = "customer" | "driver" | "staff" | "admin";
export type SessionPayload = { userId: number; role: Role; expiresAt: string };

export const SESSION_COOKIE = "cp_session";
export const SESSION_MAX_AGE_DAYS = 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set — add it to .env.local (see .env.example).");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_DAYS}d`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
