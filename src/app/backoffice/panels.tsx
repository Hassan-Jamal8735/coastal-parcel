import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { boCreateStaff, boMarkMessageRead, boRemoveCountryRates, boRemoveStaff, boSaveCountryRates, boSavePricing, boSaveShipment, boSetDriverStatus } from "@/app/actions/backoffice";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { FleetMap, type FleetDriver } from "@/components/fleet-map";
import { TrackingMap, type MapPoint } from "@/components/tracking-map";
import { db } from "@/db";
import { contactMessages, shipments, users } from "@/db/schema";
import { ACTIVE_DELIVERY_STATUSES, COUNTRIES, formatMoney, SERVICE_TYPES, SHIPMENT_PURPOSES, SHIPMENT_STATUS_LABELS, serviceLabel, SITE_TIMEZONE, statusLabel } from "@/lib/constants";
import { getCountryRates, getPricingSettings, type CountryRates } from "@/lib/pricing";
import { formatDateTime, getLiveDriverLocation, getTrackingEvents, timeAgo } from "@/lib/tracking";

/** Panels of /backoffice — ports of the cp_bo_render_* functions in WordPress inc/backoffice.php. */

const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-US");
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: SITE_TIMEZONE });
const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const smallBtn = { padding: "6px 16px", fontSize: 12 };
const dangerBtn = { padding: "6px 14px", fontSize: 12, color: "#b3401f", borderColor: "#b3401f" };
const sectionHeading = { border: "none", paddingTop: 0 };

function StatusBadge({ status }: { status: string }) {
  return <span className={`shipment-status-badge status-${status}`}>{statusLabel(status)}</span>;
}

const customers = alias(users, "customer");
const drivers = alias(users, "driver");

/* ---------------- Overview ---------------- */

export async function OverviewPanel() {
  const [[ship], [revenue], [cust], [approved], [pending], [msgs], recent] = await Promise.all([
    db.select({ n: count() }).from(shipments),
    db.select({ total: sum(shipments.priceAmount) }).from(shipments).where(eq(shipments.paymentStatus, "paid")),
    db.select({ n: count() }).from(users).where(eq(users.role, "customer")),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "driver"), eq(users.driverStatus, "approved"))),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "driver"), eq(users.driverStatus, "pending"))),
    db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.status, "new")),
    db.select().from(shipments).orderBy(desc(shipments.createdAt)).limit(5),
  ]);

  return (
    <>
      <h2>Overview</h2>
      <p className="dashboard-panel-subtext">A quick look at the whole operation.</p>
      <div className="dashboard-stat-row">
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{ship.n}</div><div className="dashboard-stat-label">Total Shipments</div></div>
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{naira(Number(revenue.total ?? 0))}</div><div className="dashboard-stat-label">Revenue Collected</div></div>
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{cust.n}</div><div className="dashboard-stat-label">Customers</div></div>
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{approved.n}</div><div className="dashboard-stat-label">Approved Drivers</div></div>
      </div>

      {(pending.n > 0 || msgs.n > 0) && (
        <div className="auth-notice">
          {pending.n > 0 && (
            <>
              <Link href="/backoffice?panel=drivers">{pending.n} driver application(s) awaiting review.</Link>
              <br />
            </>
          )}
          {msgs.n > 0 && <Link href="/backoffice?panel=messages">{msgs.n} new contact message(s).</Link>}
        </div>
      )}

      <h3 className="ship-section-heading" style={sectionHeading}>Recent Shipments</h3>
      {recent.length === 0 ? (
        <div className="dashboard-empty-state"><p>No shipments yet.</p></div>
      ) : (
        <table className="bo-table">
          <thead><tr><th>ID</th><th>Route</th><th>Status</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{s.pickupCity} &rarr; {s.deliveryCity}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{naira(s.priceAmount)}</td>
                <td><Link href={`/backoffice?panel=shipments&view=${s.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------------- Shipments ---------------- */

export async function ShipmentsPanel({ view, saved }: { view: number; saved: boolean }) {
  if (view) return <ShipmentDetail id={view} saved={saved} />;

  const rows = await db
    .select({ s: shipments, customerName: customers.name, driverName: drivers.name })
    .from(shipments)
    .leftJoin(customers, eq(customers.id, shipments.customerId))
    .leftJoin(drivers, eq(drivers.id, shipments.driverId))
    .orderBy(desc(shipments.createdAt));

  return (
    <>
      <h2>Shipments</h2>
      <p className="dashboard-panel-subtext">All shipments across the platform.</p>
      {rows.length === 0 ? (
        <div className="dashboard-empty-state"><p>No shipments yet.</p></div>
      ) : (
        <table className="bo-table">
          <thead><tr><th>ID</th><th>Tracking #</th><th>Customer</th><th>Route</th><th>Status</th><th>Payment</th><th>Driver</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ s, customerName, driverName }) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{s.trackingNumber ? <code>{s.trackingNumber}</code> : "—"}</td>
                <td>{customerName ?? `${s.senderName} (guest)`}</td>
                <td>{s.pickupCity} &rarr; {s.deliveryCity}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{ucfirst(s.paymentStatus)}</td>
                <td>{driverName ?? "—"}</td>
                <td><Link href={`/backoffice?panel=shipments&view=${s.id}`} className="main-button w-button" style={smallBtn}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

async function ShipmentDetail({ id, saved }: { id: number; saved: boolean }) {
  const [row] = await db
    .select({ s: shipments, customerName: customers.name, customerEmail: customers.email })
    .from(shipments)
    .leftJoin(customers, eq(customers.id, shipments.customerId))
    .where(eq(shipments.id, id))
    .limit(1);
  if (!row) return <p>Shipment not found.</p>;
  const { s } = row;

  const [events, live, approvedDrivers] = await Promise.all([
    getTrackingEvents(s.id),
    getLiveDriverLocation(s),
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.role, "driver"), eq(users.driverStatus, "approved"))).orderBy(users.name),
  ]);
  const points: MapPoint[] = events
    .filter((e) => e.lat != null && e.lng != null)
    .map((e) => ({ lat: Number(e.lat), lng: Number(e.lng), label: `${statusLabel(e.status)} — ${formatDateTime(e.createdAt, false)}` }));

  const purpose = SHIPMENT_PURPOSES[s.shipmentPurpose as keyof typeof SHIPMENT_PURPOSES] ?? s.shipmentPurpose;
  const charged = s.chargeCurrency && s.chargeAmount != null && s.chargeCurrency !== "NGN" ? ` (charged ${formatMoney(s.chargeAmount, s.chargeCurrency)})` : "";

  return (
    <>
      <p className="sd-back">
        <Link href="/backoffice?panel=shipments">&larr; All shipments</Link>
      </p>
      <div className="sd-header">
        <div>
          <h2 className="sd-title">Shipment #{s.id}</h2>
          <div className="sd-sub">
            <StatusBadge status={s.status} />
            {s.trackingNumber && <span className="shipment-tracking-number">{s.trackingNumber}</span>}
            <span className="sd-muted">Booked {formatDateTime(s.createdAt)}</span>
          </div>
        </div>
        {s.trackingNumber && (
          <Link href={`/track-shipment?tracking=${s.trackingNumber}`} className="sd-header-link" target="_blank">
            View public tracking &rarr;
          </Link>
        )}
      </div>
      {saved && <div className="dashboard-success">Shipment updated.</div>}

      <div className="bo-grid">
        <div className="bo-col-main">
          <section className="bo-card">
            <h3 className="sd-card-title">Customer &amp; route</h3>
            <p className="sd-customer">
              {row.customerName ? (
                <>
                  <strong>{row.customerName}</strong> <span className="sd-muted">· {row.customerEmail}</span>
                </>
              ) : (
                <>
                  <strong>Guest checkout</strong> <span className="sd-muted">· {s.senderEmail ?? "no email"}</span>
                </>
              )}
            </p>
            <div className="shipment-pickup-delivery sd-route">
              <div>
                <p className="shipment-pd-label">Pickup from</p>
                <p className="sd-strong">{s.senderName}</p>
                <p className="sd-muted">{s.senderPhone}</p>
                <p>
                  {s.pickupAddress}
                  <br />
                  {s.pickupCity}
                  {s.pickupPostalCode ? ` ${s.pickupPostalCode}` : ""}, {s.pickupCountry}
                </p>
                {s.pickupLat != null && s.pickupLng != null && (
                  <p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${s.pickupLat},${s.pickupLng}`} target="_blank" rel="noopener noreferrer">
                      Exact spot on map
                    </a>
                  </p>
                )}
              </div>
              <div>
                <p className="shipment-pd-label">Deliver to</p>
                <p className="sd-strong">{s.receiverName}</p>
                <p className="sd-muted">{s.receiverPhone}</p>
                <p>
                  {s.deliveryAddress}
                  <br />
                  {s.deliveryCity}
                  {s.deliveryPostalCode ? ` ${s.deliveryPostalCode}` : ""}, {s.deliveryCountry}
                </p>
                {s.deliveryLat != null && s.deliveryLng != null && (
                  <p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${s.deliveryLat},${s.deliveryLng}`} target="_blank" rel="noopener noreferrer">
                      Exact spot on map
                    </a>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="bo-card">
            <h3 className="sd-card-title">Package &amp; payment</h3>
            <dl className="sd-facts">
              <Fact label="Service">{serviceLabel(s.serviceType ?? "") || "—"}</Fact>
              <Fact label="Contents">{s.isDocument ? "Document" : "Package"}</Fact>
              <Fact label="Pieces">{s.packagePieces || 1}</Fact>
              <Fact label="Total weight">{s.packageWeight} kg</Fact>
              <Fact label="Purpose">{purpose || "—"}</Fact>
              <Fact label="Reference">{s.shipmentReference || "—"}</Fact>
              <Fact label="Price">
                {naira(s.priceAmount)}
                {charged}
              </Fact>
              <Fact label="Payment">
                {ucfirst(s.paymentStatus)}
                {s.paymentGateway && <span className="sd-muted"> · {s.paymentGateway}</span>}
              </Fact>
              {s.paymentReference && (
                <Fact label="Payment reference" wide>
                  <code className="sd-code">{s.paymentReference}</code>
                </Fact>
              )}
              {s.notes && (
                <Fact label="Customer notes" wide>
                  {s.notes}
                </Fact>
              )}
            </dl>
          </section>

          {s.customsItemDescription && (
            <section className="bo-card">
              <h3 className="sd-card-title">Customs invoice</h3>
              <dl className="sd-facts">
                <Fact label="Item">
                  {s.customsItemDescription}
                  {s.customsCommodityCode && <span className="sd-muted"> ({s.customsCommodityCode})</span>}
                </Fact>
                <Fact label="Origin">{s.customsCountryOfOrigin || "—"}</Fact>
                <Fact label="Declared value">
                  &#8358;{(s.customsDeclaredValueNgn ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Fact>
                {s.customsRemarks && (
                  <Fact label="Remarks" wide>
                    {s.customsRemarks}
                  </Fact>
                )}
              </dl>
            </section>
          )}

          {(s.pickupPhotoUrl || s.deliveryPhotoUrl) && (
            <section className="bo-card">
              <h3 className="sd-card-title">Photos</h3>
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
            </section>
          )}

          {(points.length > 0 || live) && (
            <section className="bo-card">
              <h3 className="sd-card-title">{live ? "Live location" : "Location checkpoints"}</h3>
              {live && (
                <p className="cp-live-location-note">
                  <span className="cp-live-dot" />
                  Driver&apos;s current location &mdash; updated {timeAgo(live.updatedAt)} ago
                </p>
              )}
              <TrackingMap points={points} live={live} radius={8} />
            </section>
          )}

          <section className="bo-card">
            <h3 className="sd-card-title">Timeline</h3>
            {events.length === 0 ? (
              <p className="sd-muted">No events yet.</p>
            ) : (
              <ol className="sd-timeline">
                {[...events].reverse().map((e, i) => (
                  <li key={e.id} className={i === 0 ? "is-latest" : ""}>
                    <div className="sd-tl-head">
                      <strong>{statusLabel(e.status)}</strong>
                      <span className="sd-muted">
                        {formatDateTime(e.createdAt)} · {e.createdByName ?? "System"}
                      </span>
                    </div>
                    {e.note && <p className="sd-tl-note">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="bo-col-side">
          <section className="bo-card">
            <h3 className="sd-card-title">Manage</h3>
            <form action={boSaveShipment} className="sd-manage">
              <input type="hidden" name="shipment_id" value={s.id} />
              <div className="dashboard-form-field">
                <label htmlFor="bo-status">Status</label>
                <select id="bo-status" name="status" defaultValue={s.status}>
                  {Object.entries(SHIPMENT_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="bo-driver">Assigned driver</label>
                <select id="bo-driver" name="driver_id" defaultValue={s.driverId ?? ""}>
                  <option value="">No driver</option>
                  {approvedDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <p className="sd-hint">Assigning a driver moves a paid shipment to &ldquo;Assigned&rdquo; and emails the driver.</p>
              </div>
              <div className="dashboard-form-field">
                <label htmlFor="bo-note">Note (optional)</label>
                <textarea id="bo-note" name="note" rows={3} placeholder="Added to the timeline" />
              </div>
              <input type="submit" className="main-button w-button" style={{ width: "100%" }} value="Save changes" />
            </form>
          </section>
        </div>
      </div>
    </>
  );
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={"sd-fact" + (wide ? " is-wide" : "")}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ---------------- Customers ---------------- */

export async function CustomersPanel({ view }: { view: number }) {
  if (view) return <CustomerDetail id={view} />;

  const rows = await db
    .select({ u: users, shipmentCount: sql<number>`(select count(*)::int from ${shipments} where ${shipments.customerId} = ${users.id})` })
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt));

  return (
    <>
      <h2>Customers</h2>
      <p className="dashboard-panel-subtext">Everyone who has registered as a customer.</p>
      {rows.length === 0 ? (
        <div className="dashboard-empty-state"><p>No customers yet.</p></div>
      ) : (
        <table className="bo-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Shipments</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ u, shipmentCount }) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>{shipmentCount}</td>
                <td>{day(u.createdAt)}</td>
                <td><Link href={`/backoffice?panel=customers&view=${u.id}`} className="main-button w-button" style={smallBtn}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

async function CustomerDetail({ id }: { id: number }) {
  const [c] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "customer"))).limit(1);
  if (!c) return <p>Customer not found.</p>;
  const list = await db.select().from(shipments).where(eq(shipments.customerId, id)).orderBy(desc(shipments.createdAt));

  return (
    <>
      <p><Link href="/backoffice?panel=customers">&larr; Back to all customers</Link></p>
      <h2>{c.name}</h2>
      <p>{c.email} &middot; {c.phone || "—"} &middot; Joined {day(c.createdAt)}</p>
      <h3 className="ship-section-heading" style={sectionHeading}>Shipments</h3>
      {list.length === 0 ? (
        <div className="dashboard-empty-state"><p>No shipments yet.</p></div>
      ) : (
        <table className="bo-table">
          <thead><tr><th>ID</th><th>Tracking #</th><th>Route</th><th>Status</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{s.trackingNumber ? <code>{s.trackingNumber}</code> : "—"}</td>
                <td>{s.pickupCity} &rarr; {s.deliveryCity}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{naira(s.priceAmount)}</td>
                <td><Link href={`/backoffice?panel=shipments&view=${s.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------------- Drivers ---------------- */

export async function DriversPanel({ saved }: { saved: boolean }) {
  const list = await db.select().from(users).where(eq(users.role, "driver")).orderBy(desc(users.createdAt));
  return (
    <>
      <h2>Drivers</h2>
      <p className="dashboard-panel-subtext">Applications and active drivers.</p>
      {saved && <div className="dashboard-success">Driver status updated.</div>}
      {list.length === 0 ? (
        <div className="dashboard-empty-state"><p>No driver applications yet.</p></div>
      ) : (
        <table className="bo-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {list.map((d) => {
              const status = d.driverStatus ?? "pending";
              return (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.email}</td>
                  <td>{d.phone}</td>
                  <td>{d.vehicleType}</td>
                  <td><strong>{ucfirst(status)}</strong></td>
                  <td>
                    <form action={boSetDriverStatus} style={{ display: "inline" }}>
                      <input type="hidden" name="driver_id" value={d.id} />
                      {status !== "approved" && (
                        <button type="submit" name="driver_status" value="approved" className="main-button w-button" style={{ padding: "6px 14px", fontSize: 12 }}>Approve</button>
                      )}
                      {status !== "rejected" && (
                        <button type="submit" name="driver_status" value="rejected" className="nav-button transparent w-button" style={dangerBtn}>Reject</button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------------- Pricing & Payment ---------------- */

const PRICING_ERRORS: Record<string, string> = {
  country: "Please choose a country.",
  rates: "Please enter all three rates as numbers of 0 or more.",
};

function RateFields({ prefix, rates }: { prefix: string; rates?: CountryRates }) {
  return (
    <div className="pr-fields">
      <div className="dashboard-form-field">
        <label htmlFor={`${prefix}-km`}>Rate per km (NGN)</label>
        <input id={`${prefix}-km`} type="number" step="0.01" min="0" name="rate_per_km_ngn" defaultValue={rates?.ratePerKmNgn} required />
      </div>
      <div className="dashboard-form-field">
        <label htmlFor={`${prefix}-kg`}>Rate per kg (NGN)</label>
        <input id={`${prefix}-kg`} type="number" step="0.01" min="0" name="rate_per_kg_ngn" defaultValue={rates?.ratePerKgNgn} required />
      </div>
      <div className="dashboard-form-field">
        <label htmlFor={`${prefix}-pickup`}>Pickup fee (NGN)</label>
        <input id={`${prefix}-pickup`} type="number" step="0.01" min="0" name="pickup_fee_ngn" defaultValue={rates?.pickupFeeNgn} required />
      </div>
    </div>
  );
}

export async function PricingPanel({ saved, error }: { saved: boolean; error?: string }) {
  const [rates, countryRates] = await Promise.all([getPricingSettings(), getCountryRates()]);
  const configured = Object.entries(countryRates).sort(([a], [b]) => a.localeCompare(b));
  const available = COUNTRIES.filter((c) => !countryRates[c]);
  const errorText = error ? PRICING_ERRORS[error] : undefined;

  return (
    <>
      <h2>Pricing</h2>
      <p className="dashboard-panel-subtext">
        A shipment is priced with the rates of the country it ships from. Countries without their own rates use the default rates.
      </p>
      {saved && !errorText && <div className="dashboard-success">Settings saved.</div>}
      {errorText && <div className="auth-error">{errorText}</div>}

      <div className="bo-card">
        <h3>Default rates</h3>
        <p className="sd-muted">Used for every country not listed below.</p>
        <form action={boSavePricing}>
          <RateFields prefix="default" rates={rates} />
          <input type="submit" className="main-button w-button" value="Save default rates" />
        </form>
      </div>

      <div className="bo-card" id="countries">
        <h3>Country rates</h3>
        {configured.length === 0 ? (
          <p className="sd-muted">No country has its own rates yet, so every shipment uses the default rates.</p>
        ) : (
          <div className="pr-list">
            {configured.map(([country, r]) => (
              <details key={country} className="pr-row">
                <summary>
                  <span className="pr-country">{country}</span>
                  <span className="pr-sum">
                    &#8358;{r.ratePerKmNgn.toLocaleString("en-US")}/km &middot; &#8358;{r.ratePerKgNgn.toLocaleString("en-US")}/kg &middot; pickup &#8358;
                    {r.pickupFeeNgn.toLocaleString("en-US")}
                  </span>
                  <span className="pr-edit">Edit</span>
                </summary>
                <form action={boSaveCountryRates} className="pr-form">
                  <input type="hidden" name="country" value={country} />
                  <RateFields prefix={`c-${country}`} rates={r} />
                  <div className="pr-actions">
                    <input type="submit" className="main-button w-button" value="Save" />
                    <button type="submit" formAction={boRemoveCountryRates} formNoValidate className="dv-failed">
                      Remove {country}
                    </button>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}

        <h4 className="pr-add-title">Add a country</h4>
        <form action={boSaveCountryRates}>
          <div className="dashboard-form-field">
            <label htmlFor="new-country">Ships from</label>
            <select id="new-country" name="country" defaultValue="" required>
              <option value="" disabled>
                Select country
              </option>
              {available.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <RateFields prefix="new" />
          <input type="submit" className="main-button w-button" value="Add country rates" />
        </form>
      </div>
    </>
  );
}

/* ---------------- Live map ---------------- */

const LIVE_STALE_MS = 10 * 60 * 1000;

/** Active deliveries with their driver's position, split into drivers live now and shipments with no recent signal. */
async function loadFleet() {
  const rows = await db
    .select({ s: shipments, driverName: drivers.name, lat: drivers.lastLat, lng: drivers.lastLng, at: drivers.lastLocationAt, accuracy: drivers.lastAccuracyM })
    .from(shipments)
    .innerJoin(drivers, eq(drivers.id, shipments.driverId))
    .where(inArray(shipments.status, ACTIVE_DELIVERY_STATUSES))
    .orderBy(desc(shipments.updatedAt));

  // One dot per driver (a driver can carry several shipments at once).
  const byDriver = new Map<number, FleetDriver>();
  const freshIds = new Set<number>();
  for (const r of rows) {
    const fresh = r.lat != null && r.lng != null && r.at && Date.now() - r.at.getTime() <= LIVE_STALE_MS;
    if (!fresh) continue;
    freshIds.add(r.s.id);
    const d = byDriver.get(r.s.driverId!) ?? { id: r.s.driverId!, name: r.driverName, lat: Number(r.lat), lng: Number(r.lng), accuracy: r.accuracy, jobs: [] };
    d.jobs.push({ id: r.s.id, ref: r.s.trackingNumber ?? `#${r.s.id}`, route: `${r.s.pickupCity} → ${r.s.deliveryCity}`, status: statusLabel(r.s.status) });
    byDriver.set(d.id, d);
  }
  return { rows, live: [...byDriver.values()], freshIds };
}

export async function LiveMapPanel() {
  const { rows, live, freshIds } = await loadFleet();

  return (
    <>
      <h2>Live Map</h2>
      <p className="dashboard-panel-subtext">Drivers on active deliveries, updated every few seconds while their dashboard is open.</p>
      <div className="dashboard-stat-row">
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{live.length}</div><div className="dashboard-stat-label">Drivers live now</div></div>
        <div className="dashboard-stat-card"><div className="dashboard-stat-value">{rows.length}</div><div className="dashboard-stat-label">Active deliveries</div></div>
      </div>
      <FleetMap drivers={live} />
      {live.length === 0 && <p className="sd-muted">No driver is sharing a live location right now.</p>}

      {rows.length > 0 && (
        <table className="bo-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Shipment</th><th>Route</th><th>Status</th><th>Driver</th><th>Location</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const fresh = freshIds.has(r.s.id);
              return (
                <tr key={r.s.id}>
                  <td>{r.s.trackingNumber ? <code>{r.s.trackingNumber}</code> : `#${r.s.id}`}</td>
                  <td>{r.s.pickupCity} &rarr; {r.s.deliveryCity}</td>
                  <td><StatusBadge status={r.s.status} /></td>
                  <td>{r.driverName}</td>
                  <td>
                    {fresh ? (
                      <span className="live-ok">&#9679; Live {timeAgo(r.at!)} ago{r.accuracy ? ` · ±${r.accuracy} m` : ""}</span>
                    ) : (
                      <span className="sd-muted">{r.at ? `Last seen ${timeAgo(r.at)} ago` : "No signal yet"}</span>
                    )}
                  </td>
                  <td><Link href={`/backoffice?panel=shipments&view=${r.s.id}`}>View</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------------- Reports ---------------- */

export async function ReportsPanel() {
  const [byStatus, byService] = await Promise.all([
    db.select({ key: shipments.status, n: count() }).from(shipments).groupBy(shipments.status),
    db.select({ key: shipments.serviceType, n: count() }).from(shipments).groupBy(shipments.serviceType),
  ]);
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.key, r.n]));

  return (
    <>
      <h2>Reports</h2>
      <p className="dashboard-panel-subtext">Shipment breakdowns.</p>
      <div className="bo-grid">
        <div className="bo-col-main">
          <div className="bo-card">
            <h3>By Status</h3>
            <table className="bo-table">
              <tbody>
                {Object.keys(SHIPMENT_STATUS_LABELS)
                  .filter((k) => statusCount[k])
                  .map((k) => (
                    <tr key={k}><td>{statusLabel(k)}</td><td>{statusCount[k]}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bo-col-side">
          <div className="bo-card">
            <h3>By Service Type</h3>
            <table className="bo-table">
              <tbody>
                {byService.map((r) => (
                  <tr key={r.key ?? "none"}>
                    <td>{r.key && r.key in SERVICE_TYPES ? serviceLabel(r.key) : r.key || "Not selected"}</td>
                    <td>{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Messages ---------------- */

export async function MessagesPanel() {
  const list = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  return (
    <>
      <h2>Contact Messages</h2>
      <p className="dashboard-panel-subtext">Submissions from the site&apos;s Contact page.</p>
      {list.length === 0 ? (
        <div className="dashboard-empty-state"><p>No messages yet.</p></div>
      ) : (
        <div className="shipment-list">
          {list.map((m) => (
            <div key={m.id} className="shipment-card">
              <div className="shipment-card-header">
                <span className={`shipment-status-badge ${m.status === "new" ? "status-assigned" : "status-delivered"}`}>{ucfirst(m.status)}</span>
                <span className="shipment-date">{formatDateTime(m.createdAt, false)}</span>
              </div>
              <p className="shipment-route">{m.name} &mdash; {m.subject || "No subject"}</p>
              <p className="shipment-meta">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
              <p className="shipment-meta" style={{ whiteSpace: "pre-line" }}>{m.message}</p>
              {m.status === "new" && (
                <form action={boMarkMessageRead} className="shipment-actions">
                  <input type="hidden" name="message_id" value={m.id} />
                  <button type="submit" className="main-button w-button" style={smallBtn}>Mark as Read</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Staff ---------------- */

const STAFF_ERROR_TEXT: Record<string, string> = {
  fields: "Please fill in all fields.",
  email: "Please enter a valid email address.",
  exists: "An account with this email already exists.",
  password: "Password must be at least 8 characters.",
  self: "You cannot remove your own account.",
};

export async function StaffPanel({ saved, error, currentUserId }: { saved: boolean; error?: string; currentUserId: number }) {
  const staff = await db.select().from(users).where(eq(users.role, "staff")).orderBy(users.createdAt);
  const errorText = error ? STAFF_ERROR_TEXT[error] : undefined;

  return (
    <>
      <h2>Staff Accounts</h2>
      <p className="dashboard-panel-subtext">Manage who has backoffice access.</p>
      {saved && !errorText && <div className="dashboard-success">Done.</div>}

      <div className="bo-card">
        <h3>Add Staff Member</h3>
        {errorText && <div className="auth-error">{errorText}</div>}
        <form action={boCreateStaff}>
          <div className="form-row-2col">
            <div className="dashboard-form-field">
              <label htmlFor="staff-name">Full Name</label>
              <input id="staff-name" type="text" name="full_name" required />
            </div>
            <div className="dashboard-form-field">
              <label htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" name="email" required />
            </div>
          </div>
          <div className="dashboard-form-field">
            <label htmlFor="staff-password">Password</label>
            <input id="staff-password" type="password" name="password" minLength={8} required />
          </div>
          <input type="submit" className="main-button w-button" value="Create Staff Account" />
        </form>
      </div>

      <div className="bo-card">
        <h3>Current Staff</h3>
        {staff.length === 0 ? (
          <p>No staff accounts yet besides administrators.</p>
        ) : (
          <table className="bo-table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.id === currentUserId ? " (you)" : ""}</td>
                  <td>{u.email}</td>
                  <td>{day(u.createdAt)}</td>
                  <td>
                    {u.id !== currentUserId && (
                      <form action={boRemoveStaff}>
                        <input type="hidden" name="staff_id" value={u.id} />
                        <ConfirmSubmit message="Remove this staff account? This cannot be undone." className="nav-button transparent w-button" style={dangerBtn}>
                          Remove
                        </ConfirmSubmit>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
