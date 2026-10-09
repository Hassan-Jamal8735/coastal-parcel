import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { mailMarkAllRead, mailMarkUnread, mailRestore, mailSend, mailTrash } from "@/app/actions/mail";
import { LiveRefresh } from "@/components/live-refresh";
import { MailUnreadCount } from "@/components/mail-unread";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import { SITE_TIMEZONE } from "@/lib/constants";
import { MAIL_DOMAIN, MAIL_FROM, syncReceived } from "@/lib/mail";
import { formatDateTime } from "@/lib/tracking";

/** Back Office mailbox: everything received at and sent from @coastalparcel.com. */

const FOLDERS = [
  ["inbox", "Inbox"],
  ["sent", "Sent"],
  ["system", "Website emails"],
  ["trash", "Trash"],
] as const;
type Folder = (typeof FOLDERS)[number][0];

const ERRORS: Record<string, string> = {
  from: "The From address can only use letters, numbers, dots, dashes and underscores.",
  to: "Please enter at least one valid email address in To (and check Cc).",
  empty: "Please write a subject and a message.",
  size: "Attachments are too large. Keep them under 3.5 MB in total.",
  send: "The email could not be sent. Please try again.",
};
const SAVED: Record<string, string> = { sent: "Email sent.", trashed: "Moved to Trash.", restored: "Restored.", allread: "All emails marked as read." };

function folderWhere(folder: Folder): SQL {
  if (folder === "trash") return isNotNull(mailMessages.trashedAt);
  const live = isNull(mailMessages.trashedAt);
  if (folder === "inbox") return and(live, eq(mailMessages.direction, "in"))!;
  if (folder === "sent") return and(live, eq(mailMessages.direction, "out"), eq(mailMessages.kind, "manual"))!;
  return and(live, eq(mailMessages.direction, "out"), eq(mailMessages.kind, "system"))!;
}

/** "Name <a@b.c>" → "Name"; a bare address stays as it is. */
function displayName(address: string) {
  const m = address.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return m ? m[1] : address;
}
function bareAddress(address: string) {
  return address.match(/<([^>]+)>/)?.[1] ?? address.trim();
}
function when(d: Date) {
  const sameDay = d.toLocaleDateString("en-US", { timeZone: SITE_TIMEZONE }) === new Date().toLocaleDateString("en-US", { timeZone: SITE_TIMEZONE });
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SITE_TIMEZONE })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: SITE_TIMEZONE });
}
function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
/** Shown inside a sandboxed frame: links open in a new tab, no scripts run. */
function frameDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#222;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

export async function MailPanel(q: { folder?: string; view?: string; compose?: string; reply?: string; q?: string; saved?: string; error?: string }) {
  const folder: Folder = FOLDERS.some(([k]) => k === q.folder) ? (q.folder as Folder) : "inbox";
  if (folder === "inbox" && !q.view && !q.compose) await syncReceived().catch(() => 0);

  const [[unread]] = await Promise.all([
    db.select({ n: count() }).from(mailMessages).where(and(eq(mailMessages.direction, "in"), isNull(mailMessages.readAt), isNull(mailMessages.trashedAt))),
  ]);

  return (
    <>
      <div className="mail-head">
        <div>
          <h2>Mail</h2>
          <p className="dashboard-panel-subtext">Everything sent to and from @{MAIL_DOMAIN}.</p>
        </div>
        <Link href="/backoffice?panel=mail&compose=1" className="main-button w-button">
          Compose
        </Link>
      </div>
      {q.error && ERRORS[q.error] && <div className="auth-error">{ERRORS[q.error]}</div>}
      {q.saved && SAVED[q.saved] && <div className="dashboard-success">{SAVED[q.saved]}</div>}

      <div className="mail-layout">
        <nav className="mail-folders">
          {FOLDERS.map(([key, label]) => (
            <Link key={key} href={`/backoffice?panel=mail&folder=${key}`} className={"mail-folder" + (folder === key && !q.compose ? " active" : "")}>
              {label}
              {key === "inbox" && <MailUnreadCount initial={unread.n} />}
            </Link>
          ))}
        </nav>
        <div className="mail-main">
          {q.compose ? (
            <Compose replyId={Number(q.reply) || 0} />
          ) : q.view ? (
            <Message id={Number(q.view)} folder={folder} />
          ) : (
            <MessageList folder={folder} search={q.q?.trim() ?? ""} />
          )}
        </div>
      </div>
    </>
  );
}

async function MessageList({ folder, search }: { folder: Folder; search: string }) {
  const term = search ? `%${search.replace(/[%_\\]/g, (c) => "\\" + c)}%` : null;
  const where = term
    ? and(folderWhere(folder), or(ilike(mailMessages.subject, term), ilike(mailMessages.fromAddress, term), sql`${mailMessages.toAddresses}::text ilike ${term}`, ilike(mailMessages.text, term)))
    : folderWhere(folder);
  const rows = await db
    .select({
      id: mailMessages.id,
      direction: mailMessages.direction,
      from: mailMessages.fromAddress,
      to: mailMessages.toAddresses,
      subject: mailMessages.subject,
      text: mailMessages.text,
      readAt: mailMessages.readAt,
      status: mailMessages.status,
      attachments: mailMessages.attachments,
      createdAt: mailMessages.createdAt,
    })
    .from(mailMessages)
    .where(where)
    .orderBy(desc(mailMessages.createdAt))
    .limit(100);

  return (
    <>
      <div className="mail-toolbar">
      <form className="mail-search" action="/backoffice" method="get">
        <input type="hidden" name="panel" value="mail" />
        <input type="hidden" name="folder" value={folder} />
        <input type="search" name="q" defaultValue={search} placeholder="Search subject, address or text" />
        <button type="submit" className="dv-chip">
          Search
        </button>
      </form>
      {folder === "inbox" && rows.some((m) => !m.readAt) && (
        <form action={mailMarkAllRead}>
          <button type="submit" className="dv-chip">Mark all as read</button>
        </form>
      )}
      </div>
      {/* New mail appears on its own (paused while typing a search). */}
      {folder === "inbox" && <LiveRefresh interval={15000} />}
      {rows.length === 0 ? (
        <div className="dashboard-empty-state">
          <p>{search ? "No emails match your search." : folder === "inbox" ? "No emails received yet." : "Nothing here yet."}</p>
        </div>
      ) : (
        <ul className="mail-list">
          {rows.map((m) => {
            const who = m.direction === "in" ? displayName(m.from) : `To: ${m.to.map(displayName).join(", ")}`;
            const unread = m.direction === "in" && !m.readAt;
            return (
              <li key={m.id}>
                <Link href={`/backoffice?panel=mail&folder=${folder}&view=${m.id}`} className={"mail-row" + (unread ? " is-unread" : "")}>
                  <span className="mail-who">{who}</span>
                  <span className="mail-subject">
                    {m.subject || "(no subject)"}
                    <span className="mail-snippet"> &mdash; {(m.text ?? "").replace(/\s+/g, " ").slice(0, 110)}</span>
                  </span>
                  <span className="mail-meta">
                    {m.attachments.length > 0 && <span title="Has attachments">&#128206;</span>}
                    {m.status === "bounced" && <span className="mail-bounced">Bounced</span>}
                    {when(m.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function Message({ id, folder }: { id: number; folder: Folder }) {
  const [m] = await db.select().from(mailMessages).where(eq(mailMessages.id, id)).limit(1);
  if (!m) return <p>Email not found.</p>;
  if (m.direction === "in" && !m.readAt) await db.update(mailMessages).set({ readAt: new Date() }).where(eq(mailMessages.id, id));

  return (
    <article className="mail-view">
      <p className="sd-back">
        <Link href={`/backoffice?panel=mail&folder=${folder}`}>&larr; Back</Link>
      </p>
      <h3 className="mail-view-subject">{m.subject || "(no subject)"}</h3>
      <dl className="mail-view-head">
        <div><dt>From</dt><dd>{m.fromAddress}</dd></div>
        <div><dt>To</dt><dd>{m.toAddresses.join(", ")}</dd></div>
        {m.ccAddresses.length > 0 && <div><dt>Cc</dt><dd>{m.ccAddresses.join(", ")}</dd></div>}
        <div><dt>Date</dt><dd>{formatDateTime(m.createdAt)}{m.direction === "out" && <span className="sd-muted"> &middot; {m.status}</span>}</dd></div>
      </dl>

      <div className="mail-actions">
        {m.direction === "in" && !m.trashedAt && (
          <Link href={`/backoffice?panel=mail&compose=1&reply=${m.id}`} className="main-button w-button">
            Reply
          </Link>
        )}
        {m.trashedAt ? (
          <form action={mailRestore}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" className="dv-chip">Restore</button>
          </form>
        ) : (
          <form action={mailTrash}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="folder" value={folder} />
            <button type="submit" className="dv-chip">Move to Trash</button>
          </form>
        )}
        {m.direction === "in" && (
          <form action={mailMarkUnread}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" className="dv-chip">Mark unread</button>
          </form>
        )}
      </div>

      {m.html ? (
        <iframe className="mail-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={frameDoc(m.html)} title="Email content" />
      ) : (
        <pre className="mail-text">{m.text || "(empty message)"}</pre>
      )}

      {m.attachments.length > 0 && (
        <div className="mail-attachments">
          <p className="sd-card-title">Attachments</p>
          {m.attachments.map((a, i) =>
            a.url ? (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="dv-chip">
                &#128206; {a.filename} <span className="sd-muted">({sizeLabel(a.size)})</span>
              </a>
            ) : (
              <span key={i} className="dv-chip">
                &#128206; {a.filename} <span className="sd-muted">(not saved)</span>
              </span>
            ),
          )}
        </div>
      )}
    </article>
  );
}

async function Compose({ replyId }: { replyId: number }) {
  const [original] = replyId ? await db.select().from(mailMessages).where(eq(mailMessages.id, replyId)).limit(1) : [];
  const replyTo = original ? bareAddress(original.replyTo ?? original.fromAddress) : "";
  const subject = original ? (/^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`) : "";
  const quoted = original
    ? `\n\n\nOn ${formatDateTime(original.createdAt)}, ${original.fromAddress} wrote:\n${(original.text ?? "")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}`
    : "";

  return (
    <form action={mailSend} className="mail-compose">
      <h3>{original ? "Reply" : "New email"}</h3>
      {original && (
        <>
          <input type="hidden" name="reply_id" value={original.id} />
          <input type="hidden" name="in_reply_to" value={original.messageId ?? ""} />
        </>
      )}
      <div className="mail-compose-row">
        <label>From</label>
        <span className="mail-from-fixed">{MAIL_FROM}</span>
      </div>
      <div className="mail-compose-row">
        <label htmlFor="to">To</label>
        <input id="to" name="to" defaultValue={replyTo} placeholder="name@example.com, another@example.com" required />
      </div>
      <div className="mail-compose-row">
        <label htmlFor="cc">Cc</label>
        <input id="cc" name="cc" placeholder="Optional" />
      </div>
      <div className="mail-compose-row">
        <label htmlFor="subject">Subject</label>
        <input id="subject" name="subject" defaultValue={subject} required />
      </div>
      <textarea name="body" rows={14} defaultValue={quoted} placeholder="Write your message…" required autoFocus={!original} />
      <div className="mail-compose-foot">
        <label className="mail-attach">
          Attach files <input type="file" name="files" multiple />
        </label>
        <span className="sd-muted">Up to 3.5 MB in total.</span>
        <input type="submit" className="main-button w-button" value="Send" />
      </div>
    </form>
  );
}
