"use client";

import { useEffect, useRef, useState } from "react";

export type Pin = { lat: number; lng: number };
export type PinAddress = { address: string; city: string; postalCode: string; country: string };

/**
 * Optional exact-spot pin for a pickup or delivery address. Opens a map on
 * the chosen city; the customer taps the spot (or drags the pin), or uses
 * their phone's GPS when they are standing at the address. The driver's
 * Directions button then goes straight to this pin.
 */
export function LocationPinPicker({
  label,
  city,
  country,
  value,
  onChange,
  allowGps,
  onAddress,
}: {
  label: string;
  city: string;
  country: string;
  value: Pin | null;
  onChange: (pin: Pin | null) => void;
  /** Offer "Use my current location" (sensible for pickup — the sender is usually there). */
  allowGps?: boolean;
  /** Receives the address found at the pin, to fill the form's fields. */
  onAddress?: (found: PinAddress) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gpsText, setGpsText] = useState("");
  const [lookup, setLookup] = useState("");
  const lookupSeq = useRef(0);

  // Fill the address fields from the pin (latest pin wins if the customer taps quickly).
  async function fillAddress(p: Pin) {
    if (!onAddress) return;
    const seq = ++lookupSeq.current;
    setLookup("Finding the address for this spot…");
    const res = await fetch(`/api/reverse-geocode?lat=${p.lat}&lng=${p.lng}`).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (seq !== lookupSeq.current) return;
    if (!res?.ok || !data || data.error) return setLookup(data?.error ?? "Could not find the address — please type it in.");
    onAddress(data);
    setLookup(`Address filled in: ${[data.address, data.city, data.country].filter(Boolean).join(", ")}. Please check it.`);
  }
  const fillRef = useRef(fillAddress);
  useEffect(() => {
    fillRef.current = fillAddress;
  });
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const placeRef = useRef<(p: Pin, zoom?: number, silent?: boolean) => void>(() => {});

  useEffect(() => {
    if (!open || !el.current) return;
    let cancelled = false;
    import("leaflet").then(async (L) => {
      if (cancelled || !el.current) return;
      const m = L.map(el.current);
      map.current = m;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(m);
      const icon = L.icon({
        iconUrl: "/assets/leaflet/images/marker-icon.png",
        iconRetinaUrl: "/assets/leaflet/images/marker-icon-2x.png",
        shadowUrl: "/assets/leaflet/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41],
      });

      const place = (p: Pin, zoom?: number, silent?: boolean) => {
        if (!marker.current) {
          marker.current = L.marker([p.lat, p.lng], { icon, draggable: true }).addTo(m);
          marker.current.on("dragend", () => {
            const ll = marker.current!.getLatLng();
            onChange({ lat: ll.lat, lng: ll.lng });
            fillRef.current({ lat: ll.lat, lng: ll.lng });
          });
        } else marker.current.setLatLng([p.lat, p.lng]);
        if (zoom) m.setView([p.lat, p.lng], zoom);
        onChange(p);
        if (!silent) fillRef.current(p);
      };
      placeRef.current = place;
      m.on("click", (e: import("leaflet").LeafletMouseEvent) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));

      if (value) {
        place(value, 17, true);
      } else {
        m.setView([20, 0], 2);
        if (city && country) {
          const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`).catch(() => null);
          const c = res?.ok ? await res.json() : null;
          if (!cancelled && c?.lat) m.setView([c.lat, c.lng], 13);
        }
      }
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is built once per opening; later pin changes move the marker in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function useGps() {
    if (!navigator.geolocation) return setGpsText("Location is not supported on this device.");
    setGpsText("Getting your GPS position…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        placeRef.current({ lat: p.coords.latitude, lng: p.coords.longitude }, 18);
        setGpsText(`Pinned from GPS (accurate to ±${Math.round(p.coords.accuracy)} m). Drag the pin if needed.`);
      },
      (err) =>
        setGpsText(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser settings, or tap the map instead."
            : "Could not get a GPS fix. Tap the map instead.",
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  return (
    <div className="pin-picker">
      {!open ? (
        <div className="pin-summary">
          {value ? (
            <>
              <span className="pin-badge">&#9679; Exact {label.toLowerCase()} spot pinned</span>
              <button type="button" className="cp-link-button cp-inline-link" onClick={() => setOpen(true)}>
                Change
              </button>
              <button type="button" className="cp-link-button cp-inline-link" onClick={() => onChange(null)}>
                Remove
              </button>
            </>
          ) : (
            <button type="button" className="pin-open" onClick={() => setOpen(true)}>
              Pin the exact {label.toLowerCase()} spot on a map <span>(optional, helps the driver)</span>
            </button>
          )}
        </div>
      ) : (
        <div className="pin-panel">
          <p className="pin-help">Tap the map at the exact {label.toLowerCase()} spot (or drag the pin) and the address fills in for you.</p>
          {allowGps && (
            <button type="button" className="dv-chip" onClick={useGps}>
              Use my current location (GPS)
            </button>
          )}
          {gpsText && <p className="pin-gps">{gpsText}</p>}
          {lookup && <p className="pin-lookup">{lookup}</p>}
          <div ref={el} className="pin-map" />
          <div className="pin-actions">
            <button type="button" className="main-button w-button" onClick={() => setOpen(false)}>
              {value ? "Done" : "Close"}
            </button>
            {value && (
              <span className="pin-coords">
                {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
