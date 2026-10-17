"use client";

import type { WeightUnit } from "@/lib/constants";

/** kg / lb switch shown next to weight fields. */
export function WeightUnitToggle({ value, onChange, className = "" }: { value: WeightUnit; onChange: (unit: WeightUnit) => void; className?: string }) {
  return (
    <span className={"weight-unit " + className} role="group" aria-label="Weight unit">
      {(["kg", "lb"] as const).map((u) => (
        <button key={u} type="button" className={value === u ? "is-on" : ""} aria-pressed={value === u} onClick={() => onChange(u)}>
          {u}
        </button>
      ))}
    </span>
  );
}
