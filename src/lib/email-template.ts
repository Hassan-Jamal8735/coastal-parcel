import { env, siteUrl } from "./env";

/**
 * Branded HTML email layout. Table-based with inline styles, because email
 * clients (Gmail, Outlook, Apple Mail) ignore most modern CSS; a single
 * media query reflows it for phones. No server-only imports, so it can be
 * previewed or tested in isolation.
 */

export const SITE = siteUrl();

/**
 * Where email images load from: the live site's final address (www — the bare
 * domain redirects, and some mail clients won't follow that for images).
 * Never localhost, which mail clients can't reach, so emails sent from a local
 * or preview build still show the logo.
 */
const ASSET_BASE = env("EMAIL_ASSET_URL") ?? "https://www.coastalparcel.com";

const YELLOW = "#F9B416";
const DARK = "#0d0d0d";
const TEXT = "#2b2b2b";
const MUTED = "#6b6b6b";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escape user-supplied text before it goes into HTML. */
export function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type EmailContent = {
  /** Short line shown next to the subject in the inbox list. */
  preheader: string;
  heading: string;
  /** Paragraphs of plain text (escaped here). */
  intro: string[];
  /** Label/value rows shown in a details box. */
  details?: [string, string][];
  /** A one-time code, shown large and centred. */
  code?: string;
  button?: { label: string; url: string };
  /** Extra plain-text paragraphs after the button. */
  outro?: string[];
};

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const paragraphs = (lines: string[]) =>
    lines.map((p) => `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:${TEXT};">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:#f7f5f0;border-radius:10px;">
        <tr><td style="padding:8px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${c.details
              .map(
                ([label, value], i) => `<tr>
                <td class="cp-label" style="padding:10px 12px 10px 0;width:38%;vertical-align:top;font:13px/1.5 ${FONT};color:${MUTED};${i ? "border-top:1px solid #e8e4da;" : ""}">${esc(label)}</td>
                <td class="cp-value" style="padding:10px 0;vertical-align:top;font:600 15px/1.5 ${FONT};color:${DARK};${i ? "border-top:1px solid #e8e4da;" : ""}">${esc(value).replace(/\n/g, "<br>")}</td>
              </tr>`,
              )
              .join("")}
          </table>
        </td></tr>
      </table>`
    : "";

  const code = c.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr><td align="center" style="padding:20px 12px;background:#f7f5f0;border:2px dashed ${YELLOW};border-radius:10px;">
          <span style="font:700 36px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:10px;color:${DARK};">${esc(c.code)}</span>
        </td></tr>
      </table>`
    : "";

  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" class="cp-btn-wrap" style="margin:8px 0 24px;">
        <tr><td class="cp-btn" style="border-radius:6px;background:${YELLOW};" align="center">
          <a href="${esc(c.button.url)}" style="display:inline-block;padding:14px 28px;font:600 16px/1 ${FONT};color:${DARK};text-decoration:none;border-radius:6px;">${esc(c.button.label)}</a>
        </td></tr>
      </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.heading)}</title>
<style>
  @media only screen and (max-width:620px) {
    .cp-container { width:100% !important; }
    .cp-pad { padding:28px 20px !important; }
    .cp-head { padding:20px !important; }
    .cp-h1 { font-size:22px !important; }
    .cp-label, .cp-value { display:block !important; width:100% !important; }
    .cp-label { padding:12px 0 0 !important; }
    .cp-value { padding:2px 0 12px !important; border-top:0 !important; }
    .cp-btn-wrap, .cp-btn { width:100% !important; }
    .cp-btn a { display:block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#efede8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efede8;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" class="cp-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td class="cp-head" style="background:${DARK};padding:24px 32px;">
        <a href="${SITE}"><img src="${ASSET_BASE}/assets/img/email-logo.png" width="200" height="33" alt="Coastal Parcel" style="display:block;border:0;width:200px;height:auto;"></a>
      </td></tr>
      <tr><td style="height:4px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td class="cp-pad" style="padding:36px 32px 16px;">
        <h1 class="cp-h1" style="margin:0 0 20px;font:700 26px/1.25 ${FONT};color:${DARK};">${esc(c.heading)}</h1>
        ${paragraphs(c.intro)}
        ${code}
        ${details}
        ${button}
        ${c.outro ? paragraphs(c.outro) : ""}
        <p style="margin:0 0 8px;font:16px/1.6 ${FONT};color:${TEXT};">Thanks,<br>The Coastal Parcel team</p>
      </td></tr>
      <tr><td class="cp-pad" style="padding:24px 32px;background:#f7f5f0;border-top:1px solid #e8e4da;">
        <p style="margin:0 0 6px;font:600 13px/1.6 ${FONT};color:${DARK};">Need help?</p>
        <p style="margin:0;font:13px/1.7 ${FONT};color:${MUTED};">
          WhatsApp <a href="https://wa.me/2347075836785" style="color:${MUTED};">+234 707 583 6785</a> &middot;
          <a href="mailto:Info@coastalparcel.com" style="color:${MUTED};">Info@coastalparcel.com</a><br>
          3 Diffri Road Amikanle, Alagbado, Lagos, NG<br>
          <a href="${SITE}" style="color:${MUTED};">coastalparcel.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    c.heading,
    "",
    ...c.intro.flatMap((p) => [p, ""]),
    ...(c.code ? [c.code, ""] : []),
    ...(c.details ?? []).map(([l, v]) => `${l}: ${v.replace(/\n/g, ", ")}`),
    ...(c.details?.length ? [""] : []),
    ...(c.button ? [`${c.button.label}: ${c.button.url}`, ""] : []),
    ...(c.outro ?? []).flatMap((p) => [p, ""]),
    "Thanks,",
    "The Coastal Parcel team",
    "",
    "Need help? WhatsApp +234 707 583 6785 · Info@coastalparcel.com",
  ].join("\n");

  return { html, text };
}
