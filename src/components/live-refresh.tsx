"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the page's server data every `interval` ms so statuses and the
 * live driver location update without a reload (the WordPress live-poll).
 * Skips a tick while someone is typing in a field, so it never interrupts input.
 */
export function LiveRefresh({ interval = 12000 }: { interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      router.refresh();
    }, interval);
    return () => clearInterval(id);
  }, [router, interval]);
  return null;
}
