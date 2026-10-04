"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { revealActiveTab } from "./panel-switcher";

/**
 * Site-wide loading indicator: a bar across the top of the screen while a
 * page is loading or a form is being processed, and the pressed button is
 * dimmed and locked so it can't be double-submitted.
 *
 * It tracks the real work rather than guessing: server actions (fetches
 * carrying the Next-Action header), clicks on internal links (until the new
 * URL renders) and full-page form submits. Background refreshes (live
 * tracking polls) aren't counted, so the bar never flickers on its own.
 */
export function ProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [actions, setActions] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [seenUrl, setSeenUrl] = useState(pathname + "?" + search);

  // A new URL has rendered: the navigation is over.
  const url = pathname + "?" + search;
  if (url !== seenUrl) {
    setSeenUrl(url);
    setNavigating(false);
  }

  useEffect(() => {
    // Server actions: count in-flight requests.
    const original = window.fetch;
    const patched: typeof fetch = async (input, init) => {
      const isAction = new Headers(init?.headers).has("next-action");
      if (!isAction) return original(input, init);
      setActions((n) => n + 1);
      try {
        return await original(input, init);
      } finally {
        setActions((n) => Math.max(0, n - 1));
      }
    };
    window.fetch = patched;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin) return;
      // Same page (or just a #hash): nothing loads.
      if (to.pathname === location.pathname && to.search === location.search) return;
      setNavigating(true);
    }

    function onSubmit(e: SubmitEvent) {
      const button = e.submitter as HTMLElement | null;
      if (button) {
        button.classList.add("cp-busy");
        button.setAttribute("aria-busy", "true");
      }
      const form = e.target as HTMLFormElement;
      // Plain GET forms (e.g. the tracking search) load a new page outright.
      if (!e.defaultPrevented && form.method === "get") setNavigating(true);
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      window.fetch = original;
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  // Each new page: bring the active dashboard tab into view on phones.
  useEffect(() => revealActiveTab(), [url]);

  const busy = actions > 0 || navigating;

  // Work finished without leaving the page (e.g. a form error): release the button.
  useEffect(() => {
    if (busy) return;
    document.querySelectorAll(".cp-busy").forEach((el) => {
      el.classList.remove("cp-busy");
      el.removeAttribute("aria-busy");
    });
  }, [busy]);

  return <div className={"cp-progress" + (busy ? " is-active" : "")} role="progressbar" aria-hidden={!busy} aria-label="Loading" />;
}
