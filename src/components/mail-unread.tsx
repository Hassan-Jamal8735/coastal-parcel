"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The unread-mail badge, kept live: one shared check every 15 seconds (only
 * while the tab is visible) feeds every badge on the page, so a new email
 * shows up without reloading.
 */

const POLL_MS = 15_000;
let count: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let users = 0;
const listeners = new Set<() => void>();

async function check() {
  if (document.hidden) return;
  try {
    const res = await fetch("/api/mail/unread", { cache: "no-store" });
    if (!res.ok) return;
    const { unread } = (await res.json()) as { unread: number };
    if (unread !== count) {
      count = unread;
      listeners.forEach((l) => l());
    }
  } catch {
    // Offline for a moment: keep the last count.
  }
}

export function MailUnreadCount({ initial }: { initial: number }) {
  const live = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count,
    () => null,
  );

  useEffect(() => {
    users++;
    if (!timer) {
      timer = setInterval(check, POLL_MS);
      document.addEventListener("visibilitychange", check);
    }
    return () => {
      if (--users === 0 && timer) {
        clearInterval(timer);
        timer = null;
        document.removeEventListener("visibilitychange", check);
      }
    };
  }, []);

  // A fresh page render (after reading, marking all read...) is the newest truth.
  useEffect(() => {
    count = initial;
    listeners.forEach((l) => l());
  }, [initial]);

  const n = live ?? initial;
  return n > 0 ? <span className="mail-count">{n}</span> : null;
}
