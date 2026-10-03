"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";

export type Field = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  options?: string[];
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  next,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1.5 block text-sm font-semibold">{f.label}</span>
          {f.options ? (
            <select name={f.name} required defaultValue="" className="w-full rounded-lg border border-line bg-white px-4 py-3 outline-none focus:border-brand">
              <option value="" disabled>Select…</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              required
              className="w-full rounded-lg border border-line bg-white px-4 py-3 outline-none focus:border-brand"
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-3 font-bold text-ink transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
