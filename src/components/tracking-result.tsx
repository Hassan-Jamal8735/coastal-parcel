import { serviceLabel, statusLabel } from "@/lib/constants";
import type { Shipment } from "@/lib/shipments";
import { formatDateTime, getLiveDriverLocation, getTrackingEvents, timeAgo } from "@/lib/tracking";
import { TrackingMap, type MapPoint } from "./tracking-map";

/** The journey shown as a progress bar, and which step each status reaches. */
const STEPS = ["Booked", "Picked up", "In transit", "Out for delivery", "Delivered"];
const STEP_OF: Record<string, number> = { paid: 0, assigned: 0, picked_up: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 };
const PROBLEM: Record<string, string> = {
  failed: "We couldn't complete the delivery. Our team will be in touch to arrange another attempt.",
  cancelled: "This shipment has been cancelled.",
  returned: "This shipment has been returned to the sender.",
};

/** Customer-friendly wording for each timeline step. */
const DESCRIBE: Record<string, string> = {
  draft: "Shipment details saved.",
  confirmed: "Booking confirmed — awaiting payment.",
  paid: "Payment received. Your shipment is booked.",
  assigned: "A driver has been assigned to collect your parcel.",
  picked_up: "Your parcel has been collected.",
  in_transit: "Your parcel is on its way.",
  out_for_delivery: "Your parcel is out for delivery.",
  delivered: "Your parcel has been delivered.",
  failed: "Delivery attempt unsuccessful.",
  cancelled: "Shipment cancelled.",
  returned: "Shipment returned to sender.",
};

/**
 * Status, progress, live map and timeline for a tracked shipment. Anyone
 * with the tracking number can see this, so it shows friendly descriptions
 * rather than internal notes: only a driver's own delivery notes (e.g. "left
 * with receptionist") are passed through, never staff notes, payment
 * references or who made each change.
 */
export async function TrackingResult({ shipment: s }: { shipment: Shipment }) {
  const [events, live] = await Promise.all([getTrackingEvents(s.id), getLiveDriverLocation(s)]);
  const points: MapPoint[] = events
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ lat: Number(e.lat), lng: Number(e.lng), label: `${statusLabel(e.status)} — ${formatDateTime(e.createdAt, false)}` }));

  // One entry per step, at the moment it was first reached — staff
  // corrections that bounce a status back and forth don't repeat steps.
  const seen = new Set<string>();
  const timeline = events.filter((e) => !seen.has(e.status) && seen.add(e.status)).reverse();
  const step = STEP_OF[s.status] ?? -1;
  const problem = PROBLEM[s.status];
  const lastUpdate = events.at(-1)?.createdAt ?? s.updatedAt;

  return (
    <div className="tr">
      <div className="tr-head">
        <span className="shipment-tracking-number">{s.trackingNumber}</span>
        <span className={`shipment-status-badge status-${s.status}`}>{statusLabel(s.status)}</span>
      </div>
      <h3 className="tr-route">
        {s.pickupCity} <span className="tr-arrow">&rarr;</span> {s.deliveryCity}
      </h3>
      <p className="tr-countries">
        {s.pickupCountry} to {s.deliveryCountry}
      </p>

      {problem ? (
        <div className="auth-error tr-problem">{problem}</div>
      ) : step >= 0 ? (
        <ol className="tr-progress" aria-label="Delivery progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? "is-done" : i === step ? "is-current" : ""}>
              <span className="tr-dot" />
              <span className="tr-step-label">{label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="auth-notice tr-problem">This booking is awaiting payment.</div>
      )}

      <dl className="tr-facts">
        <div>
          <dt>Service</dt>
          <dd>{serviceLabel(s.serviceType ?? "") || "—"}</dd>
        </div>
        {s.deliveryEstimate && (
          <div>
            <dt>Estimated delivery</dt>
            <dd>{s.deliveryEstimate}</dd>
          </div>
        )}
        <div>
          <dt>Last update</dt>
          <dd>{formatDateTime(lastUpdate)}</dd>
        </div>
      </dl>

      {live && (
        <p className="cp-live-location-note">
          <span className="cp-live-dot" />
          Driver&apos;s current location &mdash; updated {timeAgo(live.updatedAt)} ago
        </p>
      )}
      {(points.length > 0 || live) && <TrackingMap points={points} live={live} />}

      {timeline.length > 0 && (
        <>
          <h4 className="tr-section-title">Shipment history</h4>
          <ul className="tracking-timeline tr-timeline">
            {timeline.map((e, i) => (
              <li key={e.id} className={i === 0 ? "is-latest" : ""}>
                <p className="tt-status">{statusLabel(e.status)}</p>
                <p className="tt-note">{DESCRIBE[e.status] ?? ""}</p>
                {e.note && e.createdByRole === "driver" && <p className="tt-note tt-driver-note">Driver note: {e.note}</p>}
                <p className="tt-date">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
