"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import { MAIL_FROM, sendPortalEmail } from "@/lib/mail";

/** The mailbox is the owner's: admin accounts only. */
const requireAdmin = () => requireRole("admin");

const MAX_ATTACH_BYTES = 3.5 * 1024 * 1024; // the request limit is 4 MB, with room for the message itself

const addressList = (raw: FormDataEntryValue | null) =>
  String(raw ?? "")
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter(Boolean);

function back(params: string): never {
  redirect(`/backoffice?panel=mail&${params}`);
}

export async function mailSend(formData: FormData) {
  await requireAdmin();
  const to = addressList(formData.get("to"));
  const cc = addressList(formData.get("cc"));
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 300);
  const text = String(formData.get("body") ?? "").trim();
  const inReplyTo = String(formData.get("in_reply_to") ?? "").trim() || null;
  const replyId = String(formData.get("reply_id") ?? "");
  const retry = replyId ? `compose=1&reply=${replyId}` : "compose=1";

  const email = z.email();
  if (!to.length || [...to, ...cc].some((a) => !email.safeParse(a).success)) back(`${retry}&error=to`);
  if (!subject || !text) back(`${retry}&error=empty`);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_ATTACH_BYTES) back(`${retry}&error=size`);

  try {
    await sendPortalEmail({
      from: MAIL_FROM,
      to,
      cc,
      subject,
      text,
      inReplyTo,
      files: await Promise.all(files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()), contentType: f.type || "application/octet-stream" }))),
    });
  } catch (e) {
    console.error("Portal send failed", e);
    back(`${retry}&error=send`);
  }
  back("folder=sent&saved=sent");
}

export async function mailTrash(formData: FormData) {
  await requireAdmin();
  await db.update(mailMessages).set({ trashedAt: new Date() }).where(eq(mailMessages.id, Number(formData.get("id"))));
  back(`folder=${String(formData.get("folder") ?? "inbox")}&saved=trashed`);
}

export async function mailRestore(formData: FormData) {
  await requireAdmin();
  await db.update(mailMessages).set({ trashedAt: null }).where(eq(mailMessages.id, Number(formData.get("id"))));
  back("folder=trash&saved=restored");
}

export async function mailMarkAllRead() {
  await requireAdmin();
  await db
    .update(mailMessages)
    .set({ readAt: new Date() })
    .where(and(eq(mailMessages.direction, "in"), isNull(mailMessages.readAt), isNull(mailMessages.trashedAt)));
  back("folder=inbox&saved=allread");
}

export async function mailMarkUnread(formData: FormData) {
  await requireAdmin();
  await db.update(mailMessages).set({ readAt: null }).where(eq(mailMessages.id, Number(formData.get("id"))));
  back("folder=inbox");
}
