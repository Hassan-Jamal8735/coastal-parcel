import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import { env } from "@/lib/env";
import { ingestReceived } from "@/lib/mail";

/**
 * Resend webhook: a received email (stored in the Back Office mailbox) and
 * delivery/bounce updates for sent ones. Requests are signed (Svix scheme)
 * with RESEND_WEBHOOK_SECRET; anything unsigned or stale is rejected.
 */

const TOLERANCE_S = 5 * 60;

function verify(body: string, id: string | null, timestamp: string | null, signatures: string | null) {
  const secret = env("RESEND_WEBHOOK_SECRET");
  if (!secret || !id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // The header can hold several "v1,<base64>" signatures (key rotation); any match is enough.
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const h = request.headers;
  if (!verify(body, h.get("svix-id"), h.get("svix-timestamp"), h.get("svix-signature"))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body) as { type: string; data?: { email_id?: string } };
  const emailId = event.data?.email_id;
  if (!emailId) return Response.json({ ok: true });

  if (event.type === "email.received") {
    await ingestReceived(emailId);
  } else if (event.type === "email.delivered" || event.type === "email.bounced") {
    await db.update(mailMessages).set({ status: event.type === "email.bounced" ? "bounced" : "delivered" }).where(eq(mailMessages.resendId, emailId));
  }
  return Response.json({ ok: true });
}
