/**
 * Reads configuration with stray whitespace removed. Values pasted into the
 * Vercel dashboard can pick up a leading/trailing space or line break, which
 * breaks them silently — e.g. "Bearer \nre_…" is an invalid HTTP header, so
 * every email or payment call fails. An empty value counts as unset.
 */
export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const LIVE_SITE = "https://www.coastalparcel.com";

/**
 * The site's public address, used for payment return URLs and email links.
 * A production deploy never uses a localhost value (a leftover from local
 * setup would send paying customers to a page that doesn't exist for them).
 */
export function siteUrl(): string {
  const configured = env("NEXT_PUBLIC_SITE_URL")?.replace(/\/+$/, "");
  const isProduction = process.env.VERCEL_ENV === "production";
  if (!configured || (isProduction && /localhost|127\.0\.0\.1/.test(configured))) {
    return isProduction || !configured ? LIVE_SITE : configured;
  }
  return configured;
}
