import "server-only";
import { put } from "@vercel/blob";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { mailMessages, type MailAttachment } from "@/db/schema";
import { env } from "./env";

/**
 * The Back Office mailbox. Received mail arrives through Resend Inbound (a
 * webhook, with a sync as a safety net); every email the site or the portal
 * sends through Resend is logged here too, so one place shows both sides.
 */

const API = "https://api.resend.com";
export const MAIL_DOMAIN = "coastalparcel.com";
/** Every email written in the portal goes out from the one shared address. */
export const MAIL_FROM = `Coastal Parcel <info@${MAIL_DOMAIN}>`;

async function resend(path: string, init?: RequestInit) {
  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? `Resend ${res.status}`);
  return body;
}

/** Records a sent email. Never throws: logging must not break sending. */
export async function logOutgoing(m: {
  resendId: string | null;
  kind: "system" | "manual";
  from: string;
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  inReplyTo?: string | null;
  attachments?: MailAttachment[];
  status?: string;
}) {
  try {
    await db
      .insert(mailMessages)
      .values({
        direction: "out",
        kind: m.kind,
        resendId: m.resendId,
        fromAddress: m.from,
        toAddresses: m.to,
        ccAddresses: m.cc ?? [],
        replyTo: m.replyTo ?? null,
        subject: m.subject,
        html: m.html ?? null,
        text: m.text ?? null,
        inReplyTo: m.inReplyTo ?? null,
        attachments: m.attachments ?? [],
        status: m.status ?? "sent",
      })
      .onConflictDoNothing();
  } catch (e) {
    console.error("Could not log sent email", e);
  }
}

type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  reply_to?: string[];
  subject?: string;
  html?: string | null;
  text?: string | null;
  message_id?: string | null;
  created_at: string;
  headers?: Record<string, string>;
};

/**
 * Fetches a received email from Resend and stores it, copying attachments to
 * Vercel Blob (Resend's download links expire). Safe to call twice.
 */
export async function ingestReceived(resendId: string) {
  const email = (await resend(`/emails/receiving/${encodeURIComponent(resendId)}`)) as ReceivedEmail;

  const attachments: MailAttachment[] = [];
  const list = await resend(`/emails/receiving/${encodeURIComponent(resendId)}/attachments`).catch(() => ({ data: [] }));
  for (const a of (list?.data ?? []) as { filename: string; content_type: string; size: number; download_url: string }[]) {
    let url: string | null = null;
    try {
      const file = await fetch(a.download_url);
      if (file.ok && env("BLOB_READ_WRITE_TOKEN")) {
        const blob = await put(`mail/${resendId}/${a.filename || "attachment"}`, await file.blob(), {
          access: "public",
          addRandomSuffix: true,
          contentType: a.content_type,
          token: env("BLOB_READ_WRITE_TOKEN"),
        });
        url = blob.url;
      }
    } catch (e) {
      console.error("Could not save attachment", a.filename, e);
    }
    attachments.push({ filename: a.filename || "attachment", contentType: a.content_type, size: a.size, url });
  }

  const header = (name: string) => {
    const h = email.headers ?? {};
    const key = Object.keys(h).find((k) => k.toLowerCase() === name);
    return key ? h[key] : null;
  };

  await db
    .insert(mailMessages)
    .values({
      direction: "in",
      kind: "manual",
      resendId: email.id,
      fromAddress: email.from,
      toAddresses: email.to ?? [],
      ccAddresses: email.cc ?? [],
      replyTo: email.reply_to?.[0] ?? null,
      subject: email.subject ?? "",
      html: email.html ?? null,
      text: email.text ?? null,
      messageId: email.message_id ?? null,
      inReplyTo: header("in-reply-to"),
      attachments,
      status: "received",
      createdAt: new Date(email.created_at),
    })
    .onConflictDoNothing();
}

/** Safety net for missed webhooks: stores any recent received emails not yet in the mailbox. */
export async function syncReceived() {
  if (!env("RESEND_API_KEY")) return 0;
  const list = await resend("/emails/receiving?limit=50").catch(() => null);
  const ids: string[] = (list?.data ?? []).map((e: { id: string }) => e.id);
  if (!ids.length) return 0;
  const known = await db.select({ id: mailMessages.resendId }).from(mailMessages).where(inArray(mailMessages.resendId, ids));
  const have = new Set(known.map((k) => k.id));
  const missing = ids.filter((id) => !have.has(id));
  for (const id of missing) await ingestReceived(id).catch((e) => console.error("Mail sync failed for", id, e));
  return missing.length;
}

/** Sends an email written in the portal, through Resend, and logs it. */
export async function sendPortalEmail(m: {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  inReplyTo?: string | null;
  files: { filename: string; content: Buffer; contentType: string }[];
}) {
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">${escapeHtml(m.text).replace(/\n/g, "<br>")}</div>`;
  const body = await resend("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: m.from,
      to: m.to,
      ...(m.cc.length ? { cc: m.cc } : {}),
      subject: m.subject,
      text: m.text,
      html,
      ...(m.inReplyTo ? { headers: { "In-Reply-To": m.inReplyTo, References: m.inReplyTo } } : {}),
      ...(m.files.length
        ? { attachments: m.files.map((f) => ({ filename: f.filename, content: f.content.toString("base64"), content_type: f.contentType })) }
        : {}),
    }),
  });

  // Keep a copy of attachments so the Sent folder can show them.
  const attachments: MailAttachment[] = [];
  for (const f of m.files) {
    let url: string | null = null;
    if (env("BLOB_READ_WRITE_TOKEN")) {
      try {
        url = (
          await put(`mail/sent/${f.filename}`, f.content, { access: "public", addRandomSuffix: true, contentType: f.contentType, token: env("BLOB_READ_WRITE_TOKEN") })
        ).url;
      } catch {}
    }
    attachments.push({ filename: f.filename, contentType: f.contentType, size: f.content.length, url });
  }

  await logOutgoing({
    resendId: body?.id ?? null,
    kind: "manual",
    from: m.from,
    to: m.to,
    cc: m.cc,
    subject: m.subject,
    html,
    text: m.text,
    inReplyTo: m.inReplyTo ?? null,
    attachments,
  });
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
