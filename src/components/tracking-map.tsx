"use client";

import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number; label: string };

/**
 * Leaflet map of a shipment's checkpoint pins (joined by the route line)
 * plus the driver's live position as a distinct pulsing blue dot. Leaflet
 * touches `window`, so it's loaded only in the browser.
 */
export function TrackingMap({ points, live, height = 300, radius = 12 }: { points: MapPoint[]; live?: { lat: number; lng: number; accuracy?: number | null } | null; height?: number; radius?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([points, live]);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }).addTo(map);

      // Leaflet's default marker images, served from the original theme assets.
      const pin = L.icon({
        iconUrl: "/assets/leaflet/images/marker-icon.png",
        iconRetinaUrl: "/assets/leaflet/images/marker-icon-2x.png",
        shadowUrl: "/assets/leaflet/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      const latlngs: [number, number][] = [];
      points.forEach((p) => {
        L.marker([p.lat, p.lng], { icon: pin }).addTo(map!).bindPopup(p.label);
        latlngs.push([p.lat, p.lng]);
      });
      if (latlngs.length > 1) L.polyline(latlngs, { color: "#f9b416" }).addTo(map);
      if (live) {
        const liveIcon = L.divIcon({ className: "cp-live-marker", html: '<span class="cp-live-marker-dot"></span>', iconSize: [16, 16] });
        const within = live.accuracy ? ` (accurate to ±${live.accuracy} m)` : "";
        L.marker([live.lat, live.lng], { icon: liveIcon }).addTo(map).bindPopup(`Driver’s current location${within}`);
        // The GPS accuracy radius: the driver is somewhere inside this circle.
        if (live.accuracy) L.circle([live.lat, live.lng], { radius: live.accuracy, color: "#1c6fd9", weight: 1, fillColor: "#1c6fd9", fillOpacity: 0.12 }).addTo(map);
        latlngs.push([live.lat, live.lng]);
      }
      if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [30, 30] });
      else if (latlngs.length === 1) map.setView(latlngs[0], 12);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // Rebuild only when the actual points change, not on every refresh render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} style={{ height, borderRadius: radius, margin: "20px 0" }} />;
}
