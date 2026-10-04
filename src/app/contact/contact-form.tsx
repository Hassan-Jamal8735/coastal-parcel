"use client";

import { useActionState } from "react";
import { submitContact } from "@/app/actions/contact";
import { PhoneInput } from "@/components/phone-input";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, undefined);
  const v = state?.values ?? {};

  return (
    <div className="form-block w-form">
      {state?.success ? (
        <div className="dashboard-success">{state.success}</div>
      ) : state?.error ? (
        <div className="auth-error">{state.error}</div>
      ) : null}
      {/* Re-keyed per result so the defaultValues below are re-applied: a failed form is refilled, a sent one is cleared. */}
      <form key={JSON.stringify(state ?? {})} id="email-form" name="email-form" action={action} className="form">
        <div className="div-block-41">
          <input className="contact-text-field w-input" maxLength={256} name="full_name" defaultValue={v.full_name} placeholder="Your Name*" type="text" id="name" required />
          <input className="contact-text-field w-input" maxLength={256} name="email" defaultValue={v.email} placeholder="Email*" type="email" id="email" required />
        </div>
        <div className="div-block-41">
          <PhoneInput className="contact-text-field w-input" name="phone" defaultValue={v.phone} placeholder="Phone number*" id="phone" required />
          <input className="contact-text-field w-input" maxLength={256} name="subject" defaultValue={v.subject} placeholder="Subject*" type="text" id="subject" required />
        </div>
        <textarea placeholder="How we can help..." maxLength={5000} id="message" name="message" defaultValue={v.message} className="contact-text-field text-area w-input" required />
        <input type="submit" className="main-button w-button" value={pending ? "Please wait…" : "Send message"} disabled={pending} />
      </form>
    </div>
  );
}
