"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { city: string; country: string; postalCode: string | null };

/**
 * City input with live suggestions from /api/cities, filtered by the chosen
 * country — same markup as the WordPress version (.cp-city-suggestions /
 * .cp-city-suggestion) so the original CSS styles it. Picking a suggestion
 * fills the postal code; typing a city and leaving the field also fills it
 * when there's an exact match.
 */
export function CityAutocomplete({
  name,
  country,
  value,
  onChange,
  onPostalCode,
  placeholder,
  required,
  className = "field w-input",
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

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2 || term === picked.current) return;
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
    setTimeout(() => {
      setOpen(false);
      const term = value.trim().toLowerCase();
      const exact = suggestions.find((s) => s.city.toLowerCase() === term);
      if (exact?.postalCode && value.trim() !== picked.current) onPostalCode?.(exact.postalCode);
    }, 150);
  }

  return (
    <>
      <input
        className={className}
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          picked.current = "";
          if (e.target.value.trim().length < 2) {
            setSuggestions([]);
            setOpen(false);
          }
          onChange(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={handleBlur}
      />
      <div className={"cp-city-suggestions" + (open ? " is-open" : "")}>
        {open &&
          suggestions.map((s, i) => (
            <div
              key={`${s.city}-${s.postalCode}-${i}`}
              className="cp-city-suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.city}
              {s.postalCode && <span className="cp-city-suggestion-postal">{s.postalCode}</span>}
            </div>
          ))}
      </div>
    </>
  );
}
