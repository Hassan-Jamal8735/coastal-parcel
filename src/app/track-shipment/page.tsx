import { AppHeader } from "@/components/app-header";
import { CustomerSidebar } from "@/components/customer-sidebar";
import { LiveRefresh } from "@/components/live-refresh";
import { PublicHeader } from "@/components/public-header";
import { QuoteWidget } from "@/components/quote-widget";
import { SiteFooter } from "@/components/site-footer";
import { TrackingResult } from "@/components/tracking-result";
import { getCurrentUser } from "@/lib/dal";
import { getShipmentByTracking } from "@/lib/tracking";

export const metadata = { title: "Track Shipment" };

export default async function TrackShipmentPage({ searchParams }: { searchParams: Promise<{ tracking?: string }> }) {
  const { tracking = "" } = await searchParams;
  const searched = tracking.trim();
  const shipment = searched ? await getShipmentByTracking(searched) : undefined;
  const notFound = Boolean(searched) && !shipment;
  const user = await getCurrentUser();

  // A logged-in customer gets the same lookup inside their dashboard chrome
  // instead of the marketing page, so the app experience stays seamless.
  if (user?.role === "customer") {
    return (
      <div className="full-wrapper">
        <AppHeader navLabel="Visit Site" />
        <div className="dashboard-shell">
          <CustomerSidebar />
          <main className="dashboard-main">
            <section className="dashboard-panel active" style={{ maxWidth: 720 }}>
              <h2>Track a Shipment</h2>
              <p className="dashboard-panel-subtext">Enter a tracking number to see live status updates.</p>
              <form action="/track-shipment" method="get" className="track-search-form">
                <input className="track-search-input" type="search" name="tracking" placeholder="Your Tracking Code" defaultValue={searched} required />
                <input type="submit" className="track-search-submit" value="Track" />
              </form>
              {notFound && (
                <div className="auth-error">
                  No shipment found for tracking number <strong>{searched.toUpperCase()}</strong>. Please check the code and try again.
                </div>
              )}
              {shipment && (
                <div className="tracking-result">
                  <TrackingResult shipment={shipment} />
                  <LiveRefresh />
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="full-wrapper">
      <PublicHeader />
      <section className="track-hero-section">
        <div className="track-hero-container">
          <div className="div-block-45">
            <h2 className="heading-18">Track &amp; Trace</h2>
            <p className="paragraph-17">Enter your tracking number below to see real-time updates on your shipment, from pickup to final delivery.</p>
          </div>
          <form action="/track-shipment" method="get" className="search for-track-page w-form">
            <label htmlFor="search" className="field-label">
              Search
            </label>
            <input className="search-input for-tracking-page w-input" autoFocus maxLength={256} name="tracking" placeholder="Your Tracking Code" type="search" id="search" defaultValue={searched} required />
            <input type="submit" className="search-button w-button" value="Track" />
          </form>
        </div>
      </section>

      {notFound && (
        <section style={{ padding: "60px 24px 0" }}>
          <div className="tracking-result">
            <p style={{ margin: 0 }}>
              No shipment found for tracking number <strong>{searched.toUpperCase()}</strong>. Please check the code and try again.
            </p>
          </div>
        </section>
      )}
      {shipment && (
        <section style={{ padding: "60px 24px 0" }}>
          <div className="tracking-result">
            <TrackingResult shipment={shipment} />
            <LiveRefresh />
          </div>
        </section>
      )}

      <section className="price-estimation-section">
        <div className="div-block-46">
          <div className="div-block-47">
            <h3 className="heading-19">Get a Free Domestic or International Business Shipping Quote Online</h3>
            <p className="paragraph-18">
              Packages and pallets, big and small, we can offer you an instant quote for your shipping needs both domestically and internationally. Fill out your
              shipment details below to discover your quotes. If you are satisfied, simply continue to book.
            </p>
          </div>
          <div className="div-block-48">
            <QuoteWidget />
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
