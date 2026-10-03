"use client";

import { useState } from "react";

/** Password field with the site's Show/Hide toggle (WordPress site.js added this to every password input). */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="cp-password-wrapper">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="cp-password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
