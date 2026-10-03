"use client";

import type { CSSProperties, ReactNode } from "react";

/** A submit button that asks for confirmation first (the WordPress onsubmit="return confirm(...)"). */
export function ConfirmSubmit({ message, className, style, children }: { message: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      style={style}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
