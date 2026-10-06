import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { requireRole } from "@/lib/dal";
import {
  CustomersPanel,
  DriversPanel,
  LiveMapPanel,
  MessagesPanel,
  OverviewPanel,
  PricingPanel,
  ReportsPanel,
  ShipmentsPanel,
  StaffPanel,
} from "./panels";

export const metadata = { title: "Back Office" };

const PANELS = [
  ["overview", "Overview"],
  ["shipments", "Shipments"],
  ["live", "Live Map"],
  ["customers", "Customers"],
  ["drivers", "Drivers"],
  ["pricing", "Pricing"],
  ["reports", "Reports"],
  ["messages", "Messages"],
  ["staff", "Staff Accounts"],
] as const;

type Query = { panel?: string; view?: string; saved?: string; error?: string };

export default async function BackofficePage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireRole("staff", "admin");
  const q = await searchParams;
  const panel = PANELS.some(([key]) => key === q.panel) ? q.panel! : "overview";
  const view = Number(q.view) || 0;
  const saved = q.saved !== undefined;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" minimal />
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-user">
            <p className="dashboard-user-name">{user.name}</p>
            <p className="dashboard-user-role">Back Office</p>
          </div>
          <nav className="dashboard-nav">
            {PANELS.map(([key, label]) => (
              <Link key={key} href={`/backoffice?panel=${key}`} className={"dashboard-nav-link" + (panel === key ? " active" : "")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="dashboard-nav-bottom">
            <form action={logout}>
              <button type="submit" className="cp-link-button">Log Out</button>
            </form>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="dashboard-panel active bo-panel">
            {panel === "overview" && <OverviewPanel />}
            {panel === "shipments" && <ShipmentsPanel view={view} saved={saved} />}
            {panel === "live" && <LiveMapPanel />}
            {panel === "customers" && <CustomersPanel view={view} />}
            {panel === "drivers" && <DriversPanel saved={saved} />}
            {panel === "pricing" && <PricingPanel saved={saved} error={q.error} />}
            {panel === "reports" && <ReportsPanel />}
            {panel === "messages" && <MessagesPanel />}
            {panel === "staff" && <StaffPanel saved={saved} error={q.error} currentUserId={user.id} />}
          </div>
        </main>
      </div>
      {(panel === "overview" || (panel === "shipments" && view > 0)) && <LiveRefresh interval={15000} />}
      {panel === "live" && <LiveRefresh interval={8000} />}
    </div>
  );
}
