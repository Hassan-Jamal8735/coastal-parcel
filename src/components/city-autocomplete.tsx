"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { city: string; country: string; postalCode: string | null };

/**
 * City input with live suggestions from /api/cities (filtered by the chosen
 * country). Picking a suggestion also fills the postal code; typing a city and
 * leaving the field still fills the postal code when there's an exact match.
 */
export function CityAutocomplete({
  name,
  country,
  value,
  onChange,
  onPostalCode,
  placeholder,
  required,
  className,
}: {
  name?: string;
  country: string;
  value: string;
  onChange: (city: string) => void;
  onPostalCode?: (postal: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const picked = useRef("");
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2 || term === picked.current) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/cities?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((rows: Suggestion[]) => {
          setSuggestions(rows);
          setOpen(rows.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, country]);

  function pick(s: Suggestion) {
    picked.current = s.city;
    onChange(s.city);
    if (s.postalCode) onPostalCode?.(s.postalCode);
    setOpen(false);
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      const exact = suggestions.find((s) => s.city.toLowerCase() === value.trim().toLowerCase());
      if (exact && value.trim() !== picked.current && exact.postalCode) onPostalCode?.(exact.postalCode);
    }, 150);
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          picked.current = "";
          onChange(e.target.value);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.city}-${s.postalCode}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="flex w-full justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-cream"
              >
                <span>{s.city}</span>
                {s.postalCode && <span className="text-muted">{s.postalCode}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
