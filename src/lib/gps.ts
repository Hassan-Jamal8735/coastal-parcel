"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared GPS watcher for the driver dashboard. Every part of the page
 * (the status bar, the live tracking, each status-update form) reads the
 * same fix instead of starting its own, so the phone's GPS chip is asked
 * once, in high-accuracy mode, with no cached positions.
 */

export type Fix = { lat: number; lng: number; accuracy: number; at: number };
export type GpsStatus = "idle" | "searching" | "on" | "denied" | "unavailable" | "unsupported";
type State = { status: GpsStatus; fix: Fix | null };

let state: State = { status: "idle", fix: null };
let watchId: number | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** A fix older than this is stale, however accurate it was. */
const FRESH_MS = 30_000;

/** Starts (or restarts) the GPS watch. Safe to call repeatedly. */
export function startGps() {
  if (typeof navigator === "undefined") return;
  if (!navigator.geolocation) return set({ status: "unsupported" });
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (state.status !== "on") set({ status: "searching" });
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
      // Keep the sharper fix unless the old one has gone stale or we've clearly moved.
      const prev = state.fix;
      const keepPrev = prev && Date.now() - prev.at < FRESH_MS && prev.accuracy < fix.accuracy && distanceM(prev, fix) < fix.accuracy;
      set({ status: "on", fix: keepPrev ? prev : fix });
    },
    (err) => set({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
    // High accuracy = the GPS chip, not Wi-Fi/cell estimates; maximumAge 0 = never a cached position.
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
}

/** Forgets the current fix and asks the GPS for a fresh one. */
export function refreshGps() {
  set({ fix: null, status: "searching" });
  startGps();
}

export function useGps(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Metres between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "Precise", "Good" or "Weak", for a fix's accuracy radius in metres. */
export function accuracyLabel(m: number) {
  return m <= 20 ? "Precise" : m <= 100 ? "Good" : "Weak";
}
