"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A driver's status-update form (WordPress .driver-status-form.cp-geolocate-form):
 * captures the current position as a checkpoint for the map, and requires
 * a photo only when the button pressed marks the shipment delivered.
 */
export function DriverStatusForm({
  action,
  shipmentId,
  nextStatus,
  nextLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  shipmentId: number;
  nextStatus: string;
  nextLabel: string;
}) {
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoText, setGeoText] = useState("Location: not shared yet");
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off capability check on mount
      setGeoText("Location: not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoText("Location: ready to share with this update");
      },
      () => setGeoText("Location: permission denied or unavailable (update will still work)"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const hasPhotoInput = nextStatus === "picked_up" || nextStatus === "delivered";

  return (
    <form action={action} className="driver-status-form cp-geolocate-form">
      <input type="hidden" name="shipment_id" value={shipmentId} />
      <input type="hidden" name="lat" className="cp-lat-field" value={geo?.lat ?? ""} />
      <input type="hidden" name="lng" className="cp-lng-field" value={geo?.lng ?? ""} />
      <p className="cp-geo-status" style={{ width: "100%", fontSize: 12, color: "#999", margin: 0 }}>
        {geoText}
      </p>
      <textarea name="note" placeholder="Optional note (e.g. left with receptionist)" />
      {hasPhotoInput && (
        <label className="driver-photo-label">
          {nextStatus === "picked_up" ? "Pickup photo (optional)" : "Delivery photo (required)"}
          <input ref={photoRef} type="file" name="photo" accept="image/*" className="cp-photo-input" />
        </label>
      )}
      <button
        type="submit"
        className="main-button w-button"
        onClick={(e) => {
          if (nextStatus === "delivered" && !photoRef.current?.files?.length) {
            e.preventDefault();
            alert("Please attach a photo of the delivered parcel before marking this shipment as delivered.");
          }
        }}
      >
        Mark as {nextLabel}
      </button>
      <button
        type="submit"
        name="mark_failed"
        value="1"
        className="nav-button transparent w-button"
        style={{ color: "#b3401f", borderColor: "#b3401f" }}
        onClick={(e) => {
          if (!confirm("Mark this shipment as a failed delivery?")) e.preventDefault();
        }}
      >
        Report Failed Delivery
      </button>
    </form>
  );
}
