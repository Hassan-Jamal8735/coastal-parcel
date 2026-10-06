"use client";

import { useEffect, useRef } from "react";

export type FleetDriver = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  /** Shipments this driver is carrying right now. */
  jobs: { id: number; ref: string; route: string; status: string }[];
};

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Backoffice live map: every driver on an active delivery as a labelled dot
 * with their GPS accuracy circle. Built once; the page's periodic refresh
 * moves, adds and removes dots in place, so the view isn't reset.
 */
export function FleetMap({ drivers }: { drivers: FleetDriver[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const dots = useRef(new Map<number, { marker: import("leaflet").Marker; circle: import("leaflet").Circle }>());
  const fitted = useRef(false);

  function sync(list: FleetDriver[]) {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    const seen = new Set<number>();
    for (const d of list) {
      seen.add(d.id);
      const at: [number, number] = [d.lat, d.lng];
      const jobs = d.jobs
        .map((j) => `<a href="/backoffice?panel=shipments&view=${j.id}">${escape(j.ref)}</a> · ${escape(j.route)} · ${escape(j.status)}`)
        .join("<br>") || "<span style=\"color:#1e7e42\">Available</span>";
      const popup = `<strong>${escape(d.name)}</strong>${d.accuracy ? ` <span style="color:#777">±${d.accuracy} m</span>` : ""}<br>${jobs}`;
      const existing = dots.current.get(d.id);
      if (existing) {
        existing.marker.setLatLng(at).setPopupContent(popup);
        existing.circle.setLatLng(at).setRadius(d.accuracy ?? 0);
      } else {
        const icon = lib.divIcon({
          className: "cp-fleet-marker",
          html: `<span class="cp-live-marker-dot"></span><span class="cp-fleet-label">${escape(d.name)}</span>`,
          iconSize: [16, 16],
        });
        dots.current.set(d.id, {
          marker: lib.marker(at, { icon }).addTo(m).bindPopup(popup),
          circle: lib.circle(at, { radius: d.accuracy ?? 0, color: "#1c6fd9", weight: 1, fillColor: "#1c6fd9", fillOpacity: 0.1 }).addTo(m),
        });
      }
    }
    for (const [id, dot] of dots.current) {
      if (seen.has(id)) continue;
      dot.marker.remove();
      dot.circle.remove();
      dots.current.delete(id);
    }
    // Frame everyone the first time there is someone to show; after that the viewer's view is kept.
    if (!fitted.current && list.length) {
      fitted.current = true;
      if (list.length === 1) m.setView([list[0].lat, list[0].lng], 14);
      else m.fitBounds(list.map((d) => [d.lat, d.lng] as [number, number]), { padding: [40, 40], maxZoom: 15 });
    }
  }
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  });

  useEffect(() => {
    let cancelled = false;
    const markers = dots.current;
    import("leaflet").then((lib) => {
      if (cancelled || !el.current) return;
      L.current = lib;
      const m = lib.map(el.current).setView([9, 8], 5);
      map.current = m;
      lib.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(m);
      syncRef.current(drivers);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.clear();
    };
    // Built once; updates go through sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = JSON.stringify(drivers);
  useEffect(() => {
    syncRef.current(drivers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} className="fleet-map" />;
}
