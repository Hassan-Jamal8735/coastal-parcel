import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import { MailUnreadCount } from "@/components/mail-unread";
import { MailPanel } from "./mail-panel";
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
  ["mail", "Mail"],
  ["staff", "Staff Accounts"],
] as const;

type Query = { panel?: string; view?: string; saved?: string; error?: string; folder?: string; compose?: string; reply?: string; q?: string };

/** Sections only an admin sees (the mailbox is the owner's). */
const ADMIN_ONLY = new Set(["mail"]);

export default async function BackofficePage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireRole("staff", "admin");
  const q = await searchParams;
  const isAdmin = user.role === "admin";
  const panels = PANELS.filter(([key]) => isAdmin || !ADMIN_ONLY.has(key));
  const panel = panels.some(([key]) => key === q.panel) ? q.panel! : "overview";
  const [unreadMail] = isAdmin
    ? await db.select({ n: count() }).from(mailMessages).where(and(eq(mailMessages.direction, "in"), isNull(mailMessages.readAt), isNull(mailMessages.trashedAt)))
    : [{ n: 0 }];
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
            {panels.map(([key, label]) => (
              <Link key={key} href={`/backoffice?panel=${key}`} className={"dashboard-nav-link" + (panel === key ? " active" : "")}>
                {label}
                {key === "mail" && <MailUnreadCount initial={unreadMail.n} />}
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
            {panel === "mail" && isAdmin && <MailPanel {...q} />}
            {panel === "staff" && <StaffPanel saved={saved} error={q.error} currentUserId={user.id} />}
          </div>
        </main>
      </div>
      {(panel === "overview" || (panel === "shipments" && view > 0)) && <LiveRefresh interval={15000} />}
      {panel === "live" && <LiveRefresh interval={8000} />}
    </div>
  );
}
