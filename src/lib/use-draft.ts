"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives a page refresh: the value is kept in this tab's
 * sessionStorage and restored on reload. A saved draft is only restored when
 * the page started from the same values, so arriving with a new quote (or
 * editing a different shipment) never brings back an old draft.
 * Returns [value, setValue, clear] — call clear() once the form is submitted.
 */
export function useDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState(initial);
  const base = JSON.stringify(initial);
  // The untouched starting value: never written over a saved draft before it has been restored.
  const untouched = useRef(value);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const saved = raw ? (JSON.parse(raw) as { base: string; value: T }) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists in the browser, after hydration
      if (saved && saved.base === base) setValue(saved.value);
    } catch {
      // Storage blocked or a corrupt entry: start fresh.
    }
  }, [key, base]);

  useEffect(() => {
    if (value === untouched.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ base, value }));
    } catch {
      // Storage full or blocked: the form still works, it just won't survive a refresh.
    }
  }, [key, base, value]);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }, [key]);

  return [value, setValue, clear];
}
