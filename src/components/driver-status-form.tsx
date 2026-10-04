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
  const [geoText, setGeoText] = useState("Getting your location…");
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off capability check on mount
      setGeoText("Location not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoText("Location will be shared with this update");
      },
      () => setGeoText("Location unavailable — the update still works"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const hasPhotoInput = nextStatus === "picked_up" || nextStatus === "delivered";

  const photoRequired = nextStatus === "delivered";

  return (
    <form action={action} className="driver-status-form cp-geolocate-form dv-form">
      <input type="hidden" name="shipment_id" value={shipmentId} />
      <input type="hidden" name="lat" className="cp-lat-field" value={geo?.lat ?? ""} />
      <input type="hidden" name="lng" className="cp-lng-field" value={geo?.lng ?? ""} />

      <div className="dv-form-head">
        <p className="dv-form-title">Next step: {nextLabel}</p>
        <p className={"cp-geo-status dv-geo" + (geo ? " is-on" : "")}>{geoText}</p>
      </div>

      <div className={"dv-form-fields" + (hasPhotoInput ? " has-photo" : "")}>
        <textarea name="note" rows={2} placeholder="Optional note (e.g. left with receptionist)" />
        {hasPhotoInput && (
          <label className={"dv-photo" + (photoName ? " has-file" : "")}>
            <input
              ref={photoRef}
              type="file"
              name="photo"
              accept="image/*"
              className="cp-photo-input"
              onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? "")}
            />
            <span className="dv-photo-title">{photoName ? "Photo attached" : photoRequired ? "Add delivery photo" : "Add pickup photo"}</span>
            <span className="dv-photo-sub">{photoName || (photoRequired ? "Required" : "Optional")}</span>
          </label>
        )}
      </div>

      <button
        type="submit"
        className="main-button w-button dv-primary"
        onClick={(e) => {
          if (photoRequired && !photoRef.current?.files?.length) {
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
        className="dv-failed"
        onClick={(e) => {
          if (!confirm("Mark this shipment as a failed delivery?")) e.preventDefault();
        }}
      >
        Report failed delivery
      </button>
    </form>
  );
}
