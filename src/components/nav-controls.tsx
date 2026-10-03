"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Closes whenever the route changes (React's recommended "reset state on prop change" pattern). */
function useOpenUntilNavigation() {
  const pathname = usePathname();
  const [state, setState] = useState({ open: false, path: pathname });
  if (state.path !== pathname) setState({ open: false, path: pathname });
  return [state.open, (open: boolean) => setState({ open, path: pathname })] as const;
}

/** The "Ship ▾" dropdown (Get a Quote / Track a Shipment / My Shipments). */
export function ShipDropdown({ shipmentsUrl }: { shipmentsUrl: string }) {
  const [open, setOpen] = useOpenUntilNavigation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [setOpen]);

  return (
    <div ref={ref} className={"nav-ship-dropdown" + (open ? " is-open" : "")}>
      <div className="nav-ship-dropdown-toggle nav-link" onClick={() => setOpen(!open)}>
        <span>Ship</span>
        <span className="nav-ship-dropdown-caret">&#9662;</span>
      </div>
      <div className="nav-ship-dropdown-menu">
        <Link href="/ship-now">Get a Quote</Link>
        <Link href="/track-shipment">Track a Shipment</Link>
        <Link href={shipmentsUrl}>My Shipments</Link>
      </div>
    </div>
  );
}

/**
 * Mobile menu: the collapsible <nav> plus its hamburger button, toggling
 * Webflow's own [data-nav-menu-open] / .w--open hooks so the original CSS
 * handles the look.
 */
export function NavMenuToggle({
  menuClassName,
  buttonClassName,
  button,
  children,
}: {
  menuClassName: string;
  buttonClassName: string;
  button: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useOpenUntilNavigation();
  return (
    <>
      <nav role="navigation" className={menuClassName} {...(open ? { "data-nav-menu-open": "" } : {})}>
        {children}
      </nav>
      <div className={buttonClassName + (open ? " w--open" : "")} onClick={() => setOpen(!open)}>
        {button}
      </div>
    </>
  );
}
