/**
 * Phone numbers: digits only, with an optional leading "+" for the country
 * code. Shared by the input (strips anything else as you type) and the
 * server actions (which re-check, so a hand-crafted request can't bypass it).
 */

/** Keeps digits and a single leading "+" — the as-you-type filter. */
export function cleanPhone(raw: string) {
  const trimmed = raw.trimStart();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "").slice(0, 15);
}

export const PHONE_PATTERN = "\\+?[0-9]{7,15}";
export const PHONE_ERROR = "Please enter a valid phone number (digits only, 7–15 numbers, optional + country code).";

/** The cleaned number if it's valid (7–15 digits), otherwise null. */
export function normalizePhone(raw: unknown) {
  const phone = cleanPhone(String(raw ?? ""));
  const digits = phone.replace("+", "").length;
  return digits >= 7 && digits <= 15 ? phone : null;
}
