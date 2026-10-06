"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How long after the last keystroke a refresh waits, so it never interrupts typing. */
const TYPING_PAUSE_MS = 5000;

/**
 * Re-fetches the page's server data every `interval` ms so statuses and the
 * live driver location update without a reload (the WordPress live-poll).
 * Skips a tick while the tab is hidden or someone has typed in the last few
 * seconds; an auto-focused but untouched field (the tracking search box)
 * doesn't block it.
 */
export function LiveRefresh({ interval = 12000 }: { interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    let lastTyped = 0;
    const onType = () => {
      lastTyped = Date.now();
    };
    document.addEventListener("input", onType, true);
    document.addEventListener("keydown", onType, true);
    const id = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastTyped < TYPING_PAUSE_MS) return;
      router.refresh();
    }, interval);
    return () => {
      clearInterval(id);
      document.removeEventListener("input", onType, true);
      document.removeEventListener("keydown", onType, true);
    };
  }, [router, interval]);
  return null;
}
