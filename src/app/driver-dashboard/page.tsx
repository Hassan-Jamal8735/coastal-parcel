import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { changePassword, updateProfile } from "@/app/actions/account";
import { logout } from "@/app/actions/auth";
import { driverUpdateStatus } from "@/app/actions/driver";
import { AppHeader } from "@/components/app-header";
import { DriverLocationPing } from "@/components/driver-location-ping";
import { DriverStatusForm } from "@/components/driver-status-form";
import { LiveRefresh } from "@/components/live-refresh";
import { PanelSwitcher } from "@/components/panel-switcher";
import { db } from "@/db";
import { shipments } from "@/db/schema";
import { ACTIVE_DELIVERY_STATUSES, NEXT_DRIVER_STATUS, serviceLabel, SITE_TIMEZONE, statusLabel } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { flashFor } from "@/lib/flash";
import { PhoneInput } from "@/components/phone-input";

export const metadata = { title: "Driver Dashboard" };

function Flash({ flash, form }: { flash: ReturnType<typeof flashFor>; form: string }) {
  if (!flash || flash.form !== form) return null;
  return <div className={flash.type === "error" ? "auth-error" : "dashboard-success"}>{flash.text}</div>;
}

function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
}

/** The driver's journey for the progress bar, and how many steps each status has completed. */
const DRIVER_STEPS = ["Picked up", "In transit", "Out for delivery", "Delivered"];
const DRIVER_STEP_DONE: Record<string, number> = { paid: 0, assigned: 0, picked_up: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 };

/** One stop on the route (A = pickup, B = delivery) with one-tap call, WhatsApp and directions. */
function Stop({ pin, label, current, name, phone, address, message, spot }: { pin: string; label: string; current: boolean; name: string; phone: string; address: string; message: string; spot: { lat: number | null; lng: number | null } }) {
  // An exact pin from the customer beats the typed address.
  const exact = spot.lat != null && spot.lng != null ? `${spot.lat},${spot.lng}` : null;
  const wa = whatsappLink(phone, message);
  const digits = phone.replace(/[^\d+]/g, "");
  return (
    <div className={"dv-stop" + (current ? " is-current" : "")}>
      <span className="dv-pin">{pin}</span>
      <div className="dv-stop-body">
        <p className="dv-stop-label">
          {label}
          {current && <span className="dv-next-tag">Next stop</span>}
        </p>
        <p className="dv-stop-name">{name}</p>
        <p className="dv-stop-addr">{address}</p>
        {exact && <p className="dv-pinned">&#9679; Exact spot pinned by customer</p>}
        <div className="dv-actions">
          {digits && (
            <a href={`tel:${digits}`} className="dv-chip">
              Call
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="dv-chip dv-chip-wa">
              WhatsApp
            </a>
          )}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(exact ?? address)}`} target="_blank" rel="noopener noreferrer" className="dv-chip">
            Directions
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function DriverDashboardPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireRole("driver");
  const { msg } = await searchParams;
  const flash = flashFor(msg);
  const approved = user.driverStatus === "approved";
  const list = approved ? await db.select().from(shipments).where(eq(shipments.driverId, user.id)).orderBy(desc(shipments.createdAt)) : [];
  const delivered = list.filter((s) => s.status === "delivered").length;
  const hasActive = list.some((s) => ACTIVE_DELIVERY_STATUSES.includes(s.status));

  const panel = flash?.panel ?? "overview";
  const navCls = (key: string) => "dashboard-nav-link" + (panel === key ? " active" : "");
  const cls = (key: string, extra = "") => `dashboard-panel${extra}${panel === key ? " active" : ""}`;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" minimal />
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-user">
            <p className="dashboard-user-name">{user.name}</p>
            <p className="dashboard-user-role">Driver</p>
          </div>
          <nav className="dashboard-nav">
            <button type="button" className={navCls("overview")} data-panel="overview">Overview</button>
            <button type="button" className={navCls("shipments")} data-panel="shipments">Assigned Shipments</button>
            <button type="button" className={navCls("profile")} data-panel="profile">Profile</button>
            <button type="button" className={navCls("settings")} data-panel="settings">Account Settings</button>
          </nav>
          <div className="dashboard-nav-divider" />
          <nav className="dashboard-nav dashboard-nav-secondary">
            <Link href="/track-shipment" className="dashboard-nav-link">Track a Shipment</Link>
          </nav>
          <div className="dashboard-nav-bottom">
            <form action={logout}>
              <button type="submit" className="cp-link-button">Log Out</button>
            </form>
          </div>
        </aside>

        <main className="dashboard-main">
          <section className={cls("overview")} data-panel="overview">
            <h2>Welcome, {user.name}</h2>
            <p className="dashboard-panel-subtext">Here&apos;s a quick look at your account.</p>
            {user.driverStatus === "pending" || !user.driverStatus ? (
              <div className="auth-notice">
                Your driver application is under review. We&apos;ll notify you by email once it&apos;s approved &mdash; you&apos;ll then be able to see assigned shipments here.
              </div>
            ) : user.driverStatus === "rejected" ? (
              <div className="auth-error">Your driver application was not approved. Please contact support if you believe this is a mistake.</div>
            ) : (
              <div className="dashboard-stat-row">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-value">{list.length}</div>
                  <div className="dashboard-stat-label">Assigned Shipments</div>
                </div>
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-value">{delivered}</div>
                  <div className="dashboard-stat-label">Completed Deliveries</div>
                </div>
              </div>
            )}
          </section>

          <section className={cls("shipments", " wide-panel")} data-panel="shipments">
            <h2>Assigned Shipments</h2>
            <p className="dashboard-panel-subtext">Shipments assigned to you for pickup and delivery.</p>
            <Flash flash={flash} form="driver_shipments" />
            {approved && <DriverLocationPing tracking={hasActive} />}
            {!approved ? (
              <div className="auth-notice">You&apos;ll be able to see assigned shipments here once your driver application is approved.</div>
            ) : list.length === 0 ? (
              <div className="dashboard-empty-state">
                <p>No shipments assigned to you right now.</p>
              </div>
            ) : (
              <div className="shipment-list">
                {list.map((s) => {
                  const ref = s.trackingNumber || `#${s.id}`;
                  const next = NEXT_DRIVER_STATUS[s.status];
                  const done = DRIVER_STEP_DONE[s.status] ?? 0;
                  const headingToDelivery = done >= 1;
                  return (
                    <article key={s.id} className="dv-card">
                      <header className="dv-head">
                        <div>
                          <div className="dv-ref">
                            <span className="shipment-tracking-number">{ref}</span>
                            <span className="dv-date">
                              {s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SITE_TIMEZONE })}
                            </span>
                          </div>
                          <h3 className="dv-route">
                            {s.pickupCity} <span className="tr-arrow">&rarr;</span> {s.deliveryCity}
                          </h3>
                          <p className="dv-meta">
                            {serviceLabel(s.serviceType ?? "")} &middot; {s.packageWeight} kg
                            {s.packagePieces > 1 && <> &middot; {s.packagePieces} pieces</>}
                            {s.isDocument && <> &middot; Document</>}
                          </p>
                        </div>
                        <span className={`shipment-status-badge status-${s.status}`}>{statusLabel(s.status)}</span>
                      </header>

                      {!["failed", "cancelled", "returned"].includes(s.status) && (
                        <ol className="tr-progress dv-progress" aria-label="Delivery progress">
                          {DRIVER_STEPS.map((label, i) => (
                            <li key={label} className={i < done ? "is-done" : i === done ? "is-current" : ""}>
                              <span className="tr-dot" />
                              <span className="tr-step-label">{label}</span>
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="dv-stops">
                        <Stop
                          pin="A"
                          label="Pickup"
                          current={!headingToDelivery}
                          name={s.senderName}
                          phone={s.senderPhone}
                          address={`${s.pickupAddress}, ${s.pickupCity}, ${s.pickupCountry}`}
                          spot={{ lat: s.pickupLat, lng: s.pickupLng }}
                          message={`Hi ${s.senderName}, this is your Coastal Parcel driver regarding shipment ${ref}.`}
                        />
                        <Stop
                          pin="B"
                          label="Delivery"
                          current={headingToDelivery && s.status !== "delivered"}
                          name={s.receiverName}
                          phone={s.receiverPhone}
                          address={`${s.deliveryAddress}, ${s.deliveryCity}, ${s.deliveryCountry}`}
                          spot={{ lat: s.deliveryLat, lng: s.deliveryLng }}
                          message={`Hi ${s.receiverName}, this is your Coastal Parcel driver regarding shipment ${ref}.`}
                        />
                      </div>

                      {s.notes && (
                        <p className="dv-note">
                          <strong>Customer note:</strong> {s.notes}
                        </p>
                      )}

                      {(s.pickupPhotoUrl || s.deliveryPhotoUrl) && (
                        <div className="shipment-photos">
                          {s.pickupPhotoUrl && (
                            <a href={s.pickupPhotoUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Blob URL */}
                              <img src={s.pickupPhotoUrl} alt="Pickup photo" />
                              <span>Pickup</span>
                            </a>
                          )}
                          {s.deliveryPhotoUrl && (
                            <a href={s.deliveryPhotoUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Blob URL */}
                              <img src={s.deliveryPhotoUrl} alt="Delivery photo" />
                              <span>Delivery</span>
                            </a>
                          )}
                        </div>
                      )}

                      {next ? (
                        <DriverStatusForm action={driverUpdateStatus} shipmentId={s.id} nextStatus={next} nextLabel={statusLabel(next)} />
                      ) : s.status === "delivered" ? (
                        <p className="dv-done">&#10003; Delivered &mdash; nothing more to do.</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={cls("profile")} data-panel="profile">
            <h2>Profile</h2>
            <p className="dashboard-panel-subtext">Update your personal and vehicle details.</p>
            <Flash flash={flash} form="profile" />
            <form action={updateProfile}>
              <div className="dashboard-form-field">
                <label htmlFor="p-name">Full Name</label>
                <input type="text" id="p-name" name="full_name" defaultValue={user.name} required />
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="p-email">Email</label>
                <input type="email" id="p-email" name="email" defaultValue={user.email} required />
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="p-phone">Phone Number</label>
                <PhoneInput id="p-phone" name="phone" defaultValue={user.phone ?? ""} />
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="p-vehicle">Vehicle Type</label>
                <select id="p-vehicle" name="vehicle_type" defaultValue={user.vehicleType ?? "motorcycle"}>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                </select>
              </div>
              <input type="submit" className="main-button w-button" value="Save Changes" />
            </form>
          </section>

          <section className={cls("settings")} data-panel="settings">
            <h2>Account Settings</h2>
            <p className="dashboard-panel-subtext">Change your password.</p>
            <Flash flash={flash} form="password" />
            <form action={changePassword}>
              <div className="dashboard-form-field">
                <label htmlFor="current-password">Current Password</label>
                <input type="password" id="current-password" name="current_password" required />
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="new-password">New Password</label>
                <input type="password" id="new-password" name="new_password" minLength={8} required />
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="confirm-password">Confirm New Password</label>
                <input type="password" id="confirm-password" name="confirm_password" minLength={8} required />
              </div>
              <input type="submit" className="main-button w-button" value="Change Password" />
            </form>
          </section>
        </main>
      </div>
      <PanelSwitcher />
      {approved && <LiveRefresh interval={15000} />}
    </div>
  );
}
