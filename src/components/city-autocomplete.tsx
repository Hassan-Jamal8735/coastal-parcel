"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { city: string; country: string; postalCode: string | null };

/**
 * City combobox: a dropdown of the chosen country's cities (searched as you
 * type, from /api/cities) plus a "use what I typed" row, so a city that
 * isn't in the list can still be entered manually. Uses the WordPress
 * .cp-city-suggestions / .cp-city-suggestion markup so the original CSS
 * styles it. Picking a suggestion also fills the postal code.
 *
 * It only searches and opens in response to the user — a prefilled value
 * (e.g. coming back to edit a shipment) never pops the list open on load.
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
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  // Set once the user types; until then the prefilled value is left alone.
  const [touched, setTouched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const term = value.trim();
  const canSearch = touched && Boolean(country) && term.length >= 2;

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/cities?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((rows: Suggestion[]) => {
          setSuggestions(rows);
          setActive(-1);
          setLoading(false);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, term, country]);

  const results = canSearch ? suggestions : [];
  const exactMatch = results.some((s) => s.city.toLowerCase() === term.toLowerCase());
  // "Use what I typed" — offered whenever the typed city isn't exactly in the list.
  const showManual = touched && term.length >= 2 && !exactMatch;
  const rowCount = results.length + (showManual ? 1 : 0);

  function pick(s: Suggestion) {
    onChange(s.city);
    if (s.postalCode) onPostalCode?.(s.postalCode);
    setTouched(false);
    setOpen(false);
  }

  function takeTyped() {
    onChange(term);
    setTouched(false);
    setOpen(false);
  }

  function choose(index: number) {
    if (index < results.length) pick(results[index]);
    else if (showManual) takeTyped();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!rowCount) return;
      const next = e.key === "ArrowDown" ? (active + 1) % rowCount : (active - 1 + rowCount) % rowCount;
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let hint: string | null = null;
  if (!country) hint = "Select a country first";
  else if (term.length < 2) hint = `Start typing a city in ${country}…`;
  else if (loading && !results.length) hint = "Searching…";
  else if (canSearch && !loading && !results.length) hint = `No matching cities in ${country} — you can use what you typed.`;

  return (
    <>
      <input
        className={className + " cp-city-input"}
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setTouched(true);
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      <div className={"cp-city-suggestions" + (open ? " is-open" : "")} role="listbox" id={listId} ref={listRef}>
        {open && (
          <>
            {results.map((s, i) => (
              <div
                key={`${s.city}-${s.postalCode}-${i}`}
                role="option"
                aria-selected={i === active}
                className={"cp-city-suggestion" + (i === active ? " is-active" : "")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
              >
                {s.city}
                {s.postalCode && <span className="cp-city-suggestion-postal">{s.postalCode}</span>}
              </div>
            ))}
            {showManual && (
              <div
                role="option"
                aria-selected={active === results.length}
                className={"cp-city-suggestion cp-city-manual" + (active === results.length ? " is-active" : "")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(results.length)}
                onClick={takeTyped}
              >
                Use &ldquo;{term}&rdquo; as typed
              </div>
            )}
            {hint && <div className="cp-city-hint">{hint}</div>}
          </>
        )}
      </div>
    </>
  );
}
