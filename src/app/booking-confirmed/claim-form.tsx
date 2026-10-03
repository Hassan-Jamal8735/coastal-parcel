"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ClaimState } from "@/app/actions/claim";
import { PasswordInput } from "@/components/password-input";

export function ClaimForm({
  action,
  name,
  email,
}: {
  action: (state: ClaimState, formData: FormData) => Promise<ClaimState>;
  name: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div className="ship-form-card" style={{ maxWidth: 480, margin: "24px auto 0" }}>
      <h2 className="mb-20" style={{ fontSize: 20 }}>
        Create an Account
      </h2>
      <p className="p-light">Your tracking link above works with no account needed &mdash; but creating one lets you see this and future shipments in one place, any time.</p>
      {state?.error && <div className="auth-error">{state.error}</div>}
      <form action={formAction}>
        <div className="form-field">
          <div className="label">Full Name</div>
          <input className="field w-input" type="text" name="full_name" defaultValue={name} required />
        </div>
        <div className="form-field">
          <div className="label">Email</div>
          <input className="field w-input" type="email" name="email" defaultValue={email} required />
        </div>
        <div className="form-field">
          <div className="label">Password</div>
          <PasswordInput className="field w-input" name="password" minLength={8} placeholder="At least 8 characters" required />
        </div>
        <input type="submit" className="button-2 w-button" value={pending ? "Please wait…" : "Create Account"} disabled={pending} />
      </form>
      <p className="p-light" style={{ marginTop: 14 }}>
        <Link href="/">Skip for now</Link>
      </p>
    </div>
  );
}
