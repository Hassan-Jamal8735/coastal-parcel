import { AppHeader } from "./app-header";
import { CustomerSidebar } from "./customer-sidebar";

/**
 * Shared frame for every booking step (WordPress: auth-header +
 * .dashboard-shell + customer-sidebar + .ship-form-card).
 */
export async function BookingLayout({
  active = "ship",
  minimalHeader = false,
  cardStyle,
  children,
}: {
  active?: string;
  minimalHeader?: boolean;
  cardStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" minimal={minimalHeader} />
      <div className="dashboard-shell">
        <CustomerSidebar active={active} />
        <main className="dashboard-main">
          <section className="ship-form-section">
            <div className="ship-form-card" style={cardStyle}>
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export { ShipCardSection, ShipnowStepper } from "./ship-ui";
