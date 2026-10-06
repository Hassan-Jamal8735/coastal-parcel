"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { accuracyLabel, distanceM, refreshGps, startGps, useGps } from "@/lib/gps";

/** Fixes worse than this are not sent as the live position; anything better is sent with its accuracy circle. */
const MAX_LIVE_ACCURACY_M = 1000;
/** Send when the driver has moved this far… */
const MOVE_M = 20;
/** …or at least this often while standing still. */
const EVERY_MS = 25_000;

/**
 * The driver dashboard's GPS bar: shows whether GPS is on and how precise it
 * is, lets the driver turn it on or refresh it, and can keep the screen awake
 * (phones pause GPS for web pages when the screen sleeps). While the driver
 * has an active shipment it also sends the live position for the map.
 */
export function DriverLocationPing({ tracking }: { tracking: boolean }) {
  const { status, fix } = useGps();
  const [awake, setAwake] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => startGps(), []);

  // Live position: only GPS-grade fixes, sent when the driver moves MOVE_M,
  // and re-sent every EVERY_MS while standing still (no new fix arrives then).
  useEffect(() => {
    // Sent whenever the dashboard is open: the office sees every driver; customers only see
    // the driver while their own parcel is on its way (filtered on the server).
    const send = (force: boolean) => {
      const f = fix;
      if (!f || f.accuracy > MAX_LIVE_ACCURACY_M) return;
      const prev = lastSent.current;
      if (!force && prev && distanceM(prev, f) < MOVE_M) return;
      if (force && prev && Date.now() - prev.at < EVERY_MS) return;
      lastSent.current = { lat: f.lat, lng: f.lng, at: Date.now() };
      fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: f.lat, lng: f.lng, accuracy: f.accuracy }),
      }).catch(() => {});
    };
    send(false);
    const id = setInterval(() => send(true), 5_000);
    return () => clearInterval(id);
  }, [tracking, fix]);

  // Keep the screen awake; the browser drops the lock when the tab is hidden, so re-take it on return.
  useEffect(() => {
    if (!awake) return;
    let alive = true;
    const take = async () => {
      try {
        lock.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        if (alive) setAwake(false);
      }
    };
    const onVisible = () => document.visibilityState === "visible" && take();
    take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [awake]);

  // Read on the client only: the server can't know the phone's support, and guessing breaks hydration.
  const canWake = useSyncExternalStore(
    () => () => {},
    () => "wakeLock" in navigator,
    () => false,
  );

  let tone = "is-off";
  let title = "GPS is off";
  let detail = "Turn on GPS so customers can see where their parcel is.";
  if (status === "searching") {
    tone = "is-wait";
    title = "Finding your GPS position…";
    detail = "Stand in the open for the best signal.";
  } else if (status === "on" && fix) {
    const label = accuracyLabel(fix.accuracy);
    tone = label === "Weak" ? "is-wait" : "is-on";
    title = `GPS on · ${label} (±${Math.round(fix.accuracy)} m)`;
    detail =
      label === "Weak"
        ? "Signal is weak. Move outside or near a window, or tap Refresh."
        : tracking
          ? "Your live location is being shared with this shipment."
          : "Your location is visible to the Coastal Parcel office while this page is open.";
  } else if (status === "denied") {
    title = "Location is blocked";
    detail = "Allow location for this site in your browser settings (tap the lock icon next to the address), then tap Enable GPS.";
  } else if (status === "unavailable") {
    tone = "is-wait";
    title = "No GPS signal";
    detail = "Make sure Location is turned on in your phone settings, then tap Refresh.";
  } else if (status === "unsupported") {
    title = "GPS not supported";
    detail = "This browser cannot share location. Please use Chrome or Safari on your phone.";
  }

  return (
    <div className={"gps-bar " + tone} role="status">
      <span className="gps-dot" aria-hidden="true" />
      <div className="gps-text">
        <p className="gps-title">{title}</p>
        <p className="gps-detail">{detail}</p>
      </div>
      <div className="gps-buttons">
        {status === "on" || status === "searching" ? (
          <button type="button" className="dv-chip" onClick={refreshGps}>
            Refresh
          </button>
        ) : status !== "unsupported" ? (
          <button type="button" className="dv-chip gps-enable" onClick={startGps}>
            Enable GPS
          </button>
        ) : null}
        {canWake && (
          <label className="gps-wake">
            <input type="checkbox" checked={awake} onChange={(e) => setAwake(e.target.checked)} /> Keep screen on
          </label>
        )}
      </div>
    </div>
  );
}
