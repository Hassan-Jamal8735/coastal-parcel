/**
 * Fixed flash messages for dashboard forms, keyed by the ?msg= code an action
 * redirects with — codes only, so a crafted URL can't inject arbitrary text.
 */
export const FLASH: Record<string, { form: string; panel: string; type: "error" | "success"; text: string }> = {
  profile_required: { form: "profile", panel: "profile", type: "error", text: "Name and email are required." },
  profile_email_invalid: { form: "profile", panel: "profile", type: "error", text: "Please enter a valid email address." },
  profile_email_taken: { form: "profile", panel: "profile", type: "error", text: "Another account already uses this email." },
  profile_saved: { form: "profile", panel: "profile", type: "success", text: "Profile updated successfully." },
  password_wrong: { form: "password", panel: "settings", type: "error", text: "Current password is incorrect." },
  password_short: { form: "password", panel: "settings", type: "error", text: "New password must be at least 8 characters." },
  password_mismatch: { form: "password", panel: "settings", type: "error", text: "New password and confirmation do not match." },
  password_saved: { form: "password", panel: "settings", type: "success", text: "Password changed successfully." },
  note_denied: { form: "note", panel: "shipments", type: "error", text: "You do not have access to this shipment." },
  note_empty: { form: "note", panel: "shipments", type: "error", text: "Please write a note before submitting." },
  note_saved: { form: "note", panel: "shipments", type: "success", text: "Your note has been added." },
};

export function flashFor(msg: string | undefined) {
  return msg ? FLASH[msg] : undefined;
}
