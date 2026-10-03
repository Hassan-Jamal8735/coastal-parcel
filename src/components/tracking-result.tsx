import { serviceLabel, statusLabel } from "@/lib/constants";
import type { Shipment } from "@/lib/shipments";
import { formatDateTime, getLiveDriverLocation, getTrackingEvents, timeAgo } from "@/lib/tracking";
import { TrackingMap, type MapPoint } from "./tracking-map";

/** Status, live map and timeline for a tracked shipment (WordPress template-parts/tracking-result.php). */
export async function TrackingResult({ shipment: s }: { shipment: Shipment }) {
  const [events, live] = await Promise.all([getTrackingEvents(s.id), getLiveDriverLocation(s)]);
  const points: MapPoint[] = events
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ lat: Number(e.lat), lng: Number(e.lng), label: `${statusLabel(e.status)} — ${formatDateTime(e.createdAt, false)}` }));

  return (
    <>
      <p className="shipment-tracking-number" style={{ fontSize: 16 }}>
        {s.trackingNumber}
      </p>
      <h3 style={{ margin: "16px 0 4px" }}>
        {s.pickupCity} &rarr; {s.deliveryCity}
      </h3>
      <p className="shipment-meta">
        {serviceLabel(s.serviceType)} &middot; Current status: <span className={`shipment-status-badge status-${s.status}`}>{statusLabel(s.status)}</span>
      </p>

      {live && (
        <p className="cp-live-location-note">
          <span className="cp-live-dot" />
          Driver&apos;s current location &mdash; updated {timeAgo(live.updatedAt)} ago
        </p>
      )}

      {(points.length > 0 || live) && <TrackingMap points={points} live={live} />}

      {events.length > 0 && (
        <ul className="tracking-timeline">
          {[...events].reverse().map((e) => (
            <li key={e.id}>
              <p className="tt-status">{statusLabel(e.status)}</p>
              {e.note && <p className="tt-note">{e.note}</p>}
              <p className="tt-date">{formatDateTime(e.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
