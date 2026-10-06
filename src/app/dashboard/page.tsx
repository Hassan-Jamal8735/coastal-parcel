import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { addCustomerNote, changePassword, updateProfile } from "@/app/actions/account";
import { AppHeader } from "@/components/app-header";
import { CustomerSidebar } from "@/components/customer-sidebar";
import { LiveRefresh } from "@/components/live-refresh";
import { PanelSwitcher } from "@/components/panel-switcher";
import { db } from "@/db";
import { shipments } from "@/db/schema";
import { ACTIVE_DELIVERY_STATUSES, serviceLabel, SITE_TIMEZONE, statusLabel } from "@/lib/constants";
import { driversLiveNow } from "@/lib/tracking";
import { requireRole } from "@/lib/dal";
import { flashFor } from "@/lib/flash";
import { PhoneInput } from "@/components/phone-input";

export const metadata = { title: "Dashboard" };

const INACTIVE = ["cancelled", "failed", "returned"];

function Flash({ flash, form }: { flash: ReturnType<typeof flashFor>; form: string }) {
  if (!flash || flash.form !== form) return null;
  return <div className={flash.type === "error" ? "auth-error" : "dashboard-success"}>{flash.text}</div>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireRole("customer");
  const { msg } = await searchParams;
  const flash = flashFor(msg);
  const list = await db.select().from(shipments).where(eq(shipments.customerId, user.id)).orderBy(desc(shipments.createdAt));
  // Shipments whose driver is sharing a live location right now get a "Live" link to the map.
  const live = await driversLiveNow(list.filter((s) => s.driverId && ACTIVE_DELIVERY_STATUSES.includes(s.status)).map((s) => s.driverId!));

  const completed = list.filter((s) => s.status === "delivered").length;
  const active = list.filter((s) => s.status !== "delivered" && !INACTIVE.includes(s.status)).length;
  const panel = flash?.panel ?? "overview";
  const cls = (key: string, extra = "") => `dashboard-panel${extra}${panel === key ? " active" : ""}`;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" />
      <div className="dashboard-shell">
        <CustomerSidebar active={panel} panels />
        <main className="dashboard-main">
          <section className={cls("overview")} data-panel="overview">
            <h2>Welcome, {user.name}</h2>
            <p className="dashboard-panel-subtext">Here&apos;s a quick look at your account.</p>
            <div className="dashboard-stat-row">
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{active}</div>
                <div className="dashboard-stat-label">Active Shipments</div>
              </div>
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{completed}</div>
                <div className="dashboard-stat-label">Completed Shipments</div>
              </div>
            </div>
            <div className="dashboard-empty-state">
              <p>Ready to send a package?</p>
              <p style={{ marginTop: 12 }}>
                <Link href="/ship" className="main-button w-button">Create a Shipment</Link>
              </p>
            </div>
          </section>

          <section className={cls("shipments", " wide-panel")} data-panel="shipments">
            <h2>My Shipments</h2>
            <p className="dashboard-panel-subtext">Track and manage all your shipments in one place.</p>
            <Flash flash={flash} form="note" />
            {list.length === 0 ? (
              <div className="dashboard-empty-state">
                <p>You don&apos;t have any shipments yet.</p>
                <p style={{ marginTop: 12 }}>
                  <Link href="/ship" className="main-button w-button">Create a Shipment</Link>
                </p>
              </div>
            ) : (
              <div className="shipment-list">
                {list.map((s) => (
                  <div key={s.id} className="shipment-card">
                    <div className="shipment-card-header">
                      <span className="cp-badge-row">
                        <span className={`shipment-status-badge status-${s.status}`}>{statusLabel(s.status)}</span>
                        {s.driverId && live.has(s.driverId) && ACTIVE_DELIVERY_STATUSES.includes(s.status) && s.trackingNumber && (
                          <Link href={`/track-shipment?tracking=${s.trackingNumber}`} className="cp-live-badge">
                            <span className="cp-live-dot" /> Live &mdash; see where it is
                          </Link>
                        )}
                      </span>
                      <span className="shipment-date">
                        {s.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SITE_TIMEZONE })}
                      </span>
                    </div>
                    <p className="shipment-route">
                      <strong>{s.pickupCity}</strong> &rarr; <strong>{s.deliveryCity}</strong>
                    </p>
                    <p className="shipment-meta">
                      {serviceLabel(s.serviceType ?? "")} &middot; {s.packageWeight} kg &middot; &#8358;{Math.round(s.priceAmount).toLocaleString("en-US")}
                    </p>
                    <div className="shipment-actions">
                      {s.status === "draft" ? (
                        <>
                          <Link href={`/booking?shipment_id=${s.id}`} className="main-button w-button">Book Now</Link>
                          <Link href={`/ship?edit=${s.id}`} style={{ textDecoration: "underline", fontSize: 13.5 }}>Edit</Link>
                        </>
                      ) : s.status === "confirmed" ? (
                        <Link href={`/pay?shipment_id=${s.id}`} className="main-button w-button">Complete Payment</Link>
                      ) : s.trackingNumber ? (
                        <>
                          <span className="shipment-tracking-number">{s.trackingNumber}</span>
                          <Link href={`/track-shipment?tracking=${s.trackingNumber}`} style={{ textDecoration: "underline", fontSize: 13.5 }}>Track</Link>
                        </>
                      ) : null}
                    </div>
                    {s.status !== "draft" && (
                      <details className="shipment-note-toggle">
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b6b6b", marginTop: 8 }}>Add a note</summary>
                        <form action={addCustomerNote} className="shipment-note-form">
                          <input type="hidden" name="shipment_id" value={s.id} />
                          <textarea name="note" placeholder="Let us know anything we should be aware of…" required />
                          <input type="submit" className="button-2 w-button cp-note-submit" value="Submit Note" />
                        </form>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={cls("profile")} data-panel="profile">
            <h2>Profile</h2>
            <p className="dashboard-panel-subtext">Update your personal details.</p>
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
      <LiveRefresh interval={15000} />
    </div>
  );
}
