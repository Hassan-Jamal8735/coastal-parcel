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

export const metadata = { title: "Driver Dashboard" };

function Flash({ flash, form }: { flash: ReturnType<typeof flashFor>; form: string }) {
  if (!flash || flash.form !== form) return null;
  return <div className={flash.type === "error" ? "auth-error" : "dashboard-success"}>{flash.text}</div>;
}

function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
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
                  const senderWa = whatsappLink(s.senderPhone, `Hi ${s.senderName}, this is your Coastal Parcel driver regarding shipment ${ref}.`);
                  const receiverWa = whatsappLink(s.receiverPhone, `Hi ${s.receiverName}, this is your Coastal Parcel driver regarding shipment ${ref}.`);
                  const next = NEXT_DRIVER_STATUS[s.status];
                  return (
                    <div key={s.id} className="shipment-card">
                      <div className="shipment-card-header">
                        <span className={`shipment-status-badge status-${s.status}`}>{statusLabel(s.status)}</span>
                        <span className="shipment-date">
                          {s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SITE_TIMEZONE })}
                        </span>
                      </div>
                      <p className="shipment-route">
                        <strong>{s.pickupCity}</strong> &rarr; <strong>{s.deliveryCity}</strong>
                      </p>
                      <p className="shipment-meta">
                        {serviceLabel(s.serviceType ?? "")} &middot; {s.packageWeight} kg
                        {s.packagePieces > 1 && <> &middot; {s.packagePieces} pieces</>}
                      </p>

                      <div className="shipment-pickup-delivery">
                        <div>
                          <p className="shipment-pd-label">Pickup from</p>
                          <p className="shipment-meta">
                            <strong>{s.senderName}</strong> ({s.senderPhone})
                          </p>
                          <p className="shipment-meta">
                            {s.pickupAddress}, {s.pickupCity}, {s.pickupCountry}
                          </p>
                          {senderWa && (
                            <a href={senderWa} target="_blank" rel="noopener noreferrer" className="whatsapp-contact-link">WhatsApp Sender</a>
                          )}
                        </div>
                        <div>
                          <p className="shipment-pd-label">Deliver to</p>
                          <p className="shipment-meta">
                            <strong>{s.receiverName}</strong> ({s.receiverPhone})
                          </p>
                          <p className="shipment-meta">
                            {s.deliveryAddress}, {s.deliveryCity}, {s.deliveryCountry}
                          </p>
                          {receiverWa && (
                            <a href={receiverWa} target="_blank" rel="noopener noreferrer" className="whatsapp-contact-link">WhatsApp Receiver</a>
                          )}
                        </div>
                      </div>

                      {s.notes && <p className="shipment-note">Customer note: {s.notes}</p>}

                      {(s.pickupPhotoUrl || s.deliveryPhotoUrl) && (
                        <div className="shipment-photos">
                          {s.pickupPhotoUrl && (
                            <a href={s.pickupPhotoUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Blob URL, shown as-is like WordPress */}
                              <img src={s.pickupPhotoUrl} alt="Pickup photo" />
                              <span>Pickup</span>
                            </a>
                          )}
                          {s.deliveryPhotoUrl && (
                            <a href={s.deliveryPhotoUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Blob URL, shown as-is like WordPress */}
                              <img src={s.deliveryPhotoUrl} alt="Delivery photo" />
                              <span>Delivery</span>
                            </a>
                          )}
                        </div>
                      )}

                      {next ? (
                        <DriverStatusForm action={driverUpdateStatus} shipmentId={s.id} nextStatus={next} nextLabel={statusLabel(next)} />
                      ) : s.status === "delivered" ? (
                        <p className="shipment-note" style={{ color: "#1e7e42", background: "#eafaf1" }}>Delivered.</p>
                      ) : null}
                    </div>
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
                <input type="tel" id="p-phone" name="phone" defaultValue={user.phone ?? ""} />
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
      {hasActive && <DriverLocationPing />}
    </div>
  );
}
