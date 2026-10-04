"use client";

import { useEffect } from "react";

/**
 * Client-side sidebar panel switching for the dashboards — the port of the
 * WordPress site.js ".dashboard-nav-link[data-panel]" handler. The server
 * marks the initial panel active; a #hash in the URL overrides it, and the
 * URL hash is kept in sync so a refresh stays on the same panel.
 */
/** On phones the nav is a horizontal pill row; keep the active pill on screen. */
export function revealActiveTab() {
  const nav = document.querySelector<HTMLElement>(".dashboard-sidebar > .dashboard-nav:not(.dashboard-nav-secondary)");
  const active = nav?.querySelector<HTMLElement>(".dashboard-nav-link.active");
  if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
  nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
}

export function PanelSwitcher() {
  useEffect(() => {
    const shell = document.querySelector(".dashboard-shell");
    if (!shell) return;
    const links = shell.querySelectorAll<HTMLElement>(".dashboard-nav-link[data-panel]");
    const panels = shell.querySelectorAll<HTMLElement>(".dashboard-panel[data-panel]");

    const activate = (target: string) => {
      links.forEach((l) => l.classList.toggle("active", l.dataset.panel === target));
      panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === target));
      history.replaceState(history.state, "", "#" + target);
      revealActiveTab();
    };

    const onClick = (e: Event) => activate((e.currentTarget as HTMLElement).dataset.panel!);
    links.forEach((l) => l.addEventListener("click", onClick));

    const initial = location.hash.slice(1);
    if (initial && shell.querySelector(`.dashboard-panel[data-panel="${CSS.escape(initial)}"]`)) {
      activate(initial);
    } else {
      const active = shell.querySelector<HTMLElement>(".dashboard-panel.active");
      if (active?.dataset.panel) activate(active.dataset.panel);
    }
    return () => links.forEach((l) => l.removeEventListener("click", onClick));
  }, []);
  return null;
}
