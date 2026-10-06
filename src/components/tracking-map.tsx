"use client";

import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number; label: string };
type Live = { lat: number; lng: number; accuracy?: number | null } | null | undefined;

/**
 * Leaflet map of a shipment's checkpoint pins (joined by the route line)
 * plus the driver's live position as a pulsing blue dot with its GPS
 * accuracy circle. The map is built once per set of checkpoints; a new live
 * position (from the page's periodic refresh) just moves the dot, so the
 * viewer's zoom and pan are kept. Leaflet touches `window`, so it's loaded
 * only in the browser.
 */
export function TrackingMap({ points, live, height = 300, radius = 12 }: { points: MapPoint[]; live?: Live; height?: number; radius?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const dot = useRef<{ marker: import("leaflet").Marker; circle: import("leaflet").Circle } | null>(null);
  const pointsKey = JSON.stringify(points);

  function showLive(next: Live) {
    const m = map.current, lib = L.current;
    if (!m || !lib) return;
    if (!next) {
      dot.current?.marker.remove();
      dot.current?.circle.remove();
      dot.current = null;
      return;
    }
    const at: [number, number] = [next.lat, next.lng];
    const popup = `Driver’s current location${next.accuracy ? ` (accurate to ±${next.accuracy} m)` : ""}`;
    if (!dot.current) {
      const icon = lib.divIcon({ className: "cp-live-marker", html: '<span class="cp-live-marker-dot"></span>', iconSize: [16, 16] });
      dot.current = {
        marker: lib.marker(at, { icon, zIndexOffset: 1000 }).addTo(m).bindPopup(popup),
        // The GPS accuracy radius: the driver is somewhere inside this circle.
        circle: lib.circle(at, { radius: next.accuracy ?? 0, color: "#1c6fd9", weight: 1, fillColor: "#1c6fd9", fillOpacity: 0.12 }).addTo(m),
      };
    } else {
      dot.current.marker.setLatLng(at).setPopupContent(popup);
      dot.current.circle.setLatLng(at).setRadius(next.accuracy ?? 0);
    }
  }
  const showLiveRef = useRef(showLive);
  useEffect(() => {
    showLiveRef.current = showLive;
  });

  // Build the map (once per set of checkpoints).
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((lib) => {
      if (cancelled || !el.current) return;
      L.current = lib;
      const m = lib.map(el.current);
      map.current = m;
      lib.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(m);

      // Leaflet's default marker images, served from the original theme assets.
      const pin = lib.icon({
        iconUrl: "/assets/leaflet/images/marker-icon.png",
        iconRetinaUrl: "/assets/leaflet/images/marker-icon-2x.png",
        shadowUrl: "/assets/leaflet/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      const latlngs: [number, number][] = points.map((p) => {
        lib.marker([p.lat, p.lng], { icon: pin }).addTo(m).bindPopup(p.label);
        return [p.lat, p.lng];
      });
      if (latlngs.length > 1) lib.polyline(latlngs, { color: "#f9b416" }).addTo(m);
      if (live) latlngs.push([live.lat, live.lng]);
      if (latlngs.length > 1) m.fitBounds(latlngs, { padding: [30, 30], maxZoom: 16 });
      else if (latlngs.length === 1) m.setView(latlngs[0], 15);
      else m.setView([20, 0], 2);
      showLiveRef.current(live);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      dot.current = null;
    };
    // Rebuild only when the checkpoints change; live moves are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Move the live dot in place.
  const liveKey = live ? `${live.lat},${live.lng},${live.accuracy ?? ""}` : "";
  useEffect(() => {
    showLiveRef.current(live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  return <div ref={el} style={{ height, borderRadius: radius, margin: "20px 0" }} />;
}
