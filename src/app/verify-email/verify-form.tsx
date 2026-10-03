"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { logout, resendVerificationCode, verifyEmail } from "@/app/actions/auth";

export function VerifyForm({
  email,
  redirectTo,
  sendFailed,
  initialWait,
}: {
  email: string;
  redirectTo?: string;
  /** The first code email couldn't be sent. */
  sendFailed: boolean;
  /** Seconds left on the resend cooldown when the page loaded. */
  initialWait: number;
}) {
  const [state, verify, verifying] = useActionState(verifyEmail, undefined);
  const [resendState, resend, resending] = useActionState(resendVerificationCode, undefined);
  // Show whichever message is newest: a resend replaces the old verify error and vice versa.
  const message = resending || verifying ? undefined : (resendState?.at ?? 0) > (state?.at ?? 0) ? resendState : state;

  // Resend cooldown, counted down live. The deadline is absolute so the
  // countdown stays right even if the tab is in the background.
  const [initialDeadline] = useState(() => Date.now() + initialWait * 1000);
  const deadline = resendState?.cooldown ? resendState.at + resendState.cooldown * 1000 : initialDeadline;
  const [now, setNow] = useState(() => Date.now());
  // Capped at the cooldown length: `now` can be a moment stale right after a resend.
  const wait = Math.min(resendState?.cooldown ?? 60, Math.max(0, Math.ceil((deadline - now) / 1000)));

  useEffect(() => {
    if (wait === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [wait]);

  const failedFirstSend = sendFailed && !resendState;

  return (
    <div className="form-block-2 w-form">
      <form action={verify} className="form-2">
        <h1 className="mb-20">Verify your email</h1>
        {failedFirstSend ? (
          <p className="p-light">
            We couldn&apos;t send the verification email to <strong>{email}</strong>. Please use &quot;send a new code&quot; below to try again.
          </p>
        ) : (
          <p className="p-light">
            We&apos;ve sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account. It expires in 15 minutes.
          </p>
        )}
        {failedFirstSend && !message && <div className="auth-error">The verification email didn&apos;t go out.</div>}
        {message?.error && <div className="auth-error">{message.error}</div>}
        {message?.notice && <div className="dashboard-success">{message.notice}</div>}
        {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
        <div className="form-field">
          <div className="label">Verification code</div>
          <input
            className="field w-input cp-code-input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123456"
            required
            autoFocus
          />
        </div>
        <div className="spacer-20" />
        <input type="submit" className="button-2 w-button" value={verifying ? "Please wait…" : "Verify email"} disabled={verifying} />
      </form>

      <p className="auth-role-switch">
        Didn&apos;t get it? Check your spam folder, or{" "}
        {wait > 0 ? (
          <span className="cp-resend-wait">send a new code in {wait}s</span>
        ) : (
          <button type="button" className="cp-link-button cp-inline-link" disabled={resending} onClick={() => startTransition(() => resend())}>
            {resending ? "sending…" : "send a new code"}
          </button>
        )}
        .
      </p>
      <p className="auth-role-switch">
        Wrong email address?{" "}
        <button type="button" className="cp-link-button cp-inline-link" onClick={() => logout()}>
          Sign up again
        </button>
        .
      </p>
    </div>
  );
}
