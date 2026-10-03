"use client";

import { useEffect } from "react";

/**
 * While the driver has an active shipment, quietly report their position
 * every ~25s so customers and staff see a live dot on the map. Fails
 * silently if location is denied — it never blocks the dashboard.
 */
export function DriverLocationPing() {
  useEffect(() => {
    if (!navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - last < 25000) return;
        last = now;
        fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return null;
}
