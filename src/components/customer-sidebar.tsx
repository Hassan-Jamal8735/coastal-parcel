import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/dal";

/**
 * Sidebar for every customer-facing app page (dashboard and the whole
 * booking flow) — WordPress template-parts/customer-sidebar.php.
 * `active`: overview | shipments | ship | profile | settings.
 * `panels`: on /dashboard itself the entries are data-panel buttons that
 * switch panels in place (see PanelSwitcher), exactly as in WordPress.
 */
export async function CustomerSidebar({ active = "", panels = false }: { active?: string; panels?: boolean }) {
  const user = await getCurrentUser();
  const cls = (key: string) => "dashboard-nav-link" + (active === key ? " active" : "");

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-user">
        {user ? (
          <>
            <p className="dashboard-user-name">{user.name}</p>
            <p className="dashboard-user-role">Customer</p>
          </>
        ) : (
          <>
            <p className="dashboard-user-name">Guest</p>
            <p className="dashboard-user-role">Checking out as a guest &mdash; you can create an account after paying.</p>
          </>
        )}
      </div>
      <nav className="dashboard-nav">
        {user ? (
          <>
            {panels ? (
              <>
                <button type="button" className={cls("overview")} data-panel="overview">Overview</button>
                <button type="button" className={cls("shipments")} data-panel="shipments">My Shipments</button>
                <Link href="/ship" className="dashboard-nav-link">Create Shipment</Link>
                <button type="button" className={cls("profile")} data-panel="profile">Profile</button>
                <button type="button" className={cls("settings")} data-panel="settings">Account Settings</button>
              </>
            ) : (
              <>
                <Link href="/dashboard#overview" className={cls("overview")}>Overview</Link>
                <Link href="/dashboard#shipments" className={cls("shipments")}>My Shipments</Link>
                <Link href="/ship" className={cls("ship")}>Create Shipment</Link>
                <Link href="/dashboard#profile" className={cls("profile")}>Profile</Link>
                <Link href="/dashboard#settings" className={cls("settings")}>Account Settings</Link>
              </>
            )}
          </>
        ) : (
          <Link href="/ship" className={cls("ship")}>Create Shipment</Link>
        )}
      </nav>
      <div className="dashboard-nav-divider" />
      <nav className="dashboard-nav dashboard-nav-secondary">
        <Link href="/track-shipment" className="dashboard-nav-link">Track a Shipment</Link>
      </nav>
      <div className="dashboard-nav-bottom">
        {user ? (
          <form action={logout}>
            <button type="submit" className="cp-link-button">Log Out</button>
          </form>
        ) : (
          <Link href="/user-account-creation?tab=login">Log In</Link>
        )}
      </div>
    </aside>
  );
}
