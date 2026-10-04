"use client";

import { useState } from "react";
import { cleanPhone, PHONE_PATTERN } from "@/lib/phone";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  /** Controlled use: current value + change handler. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Uncontrolled use (plain server-action forms). */
  defaultValue?: string;
};

/** A phone field that only accepts digits and a leading "+". */
export function PhoneInput({ value, onValueChange, defaultValue, ...rest }: Props) {
  const [own, setOwn] = useState(() => cleanPhone(defaultValue ?? ""));
  const controlled = value !== undefined;
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? "tel"}
      pattern={PHONE_PATTERN}
      title="Digits only, 7–15 numbers, optional + country code"
      value={controlled ? value : own}
      onChange={(e) => {
        const next = cleanPhone(e.target.value);
        if (controlled) onValueChange?.(next);
        else setOwn(next);
      }}
    />
  );
}
