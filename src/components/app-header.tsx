/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { NavMenuToggle, ShipDropdown } from "./nav-controls";

/**
 * The app header (WordPress auth-header.php) for login, dashboards, the
 * booking flow and backoffice. `minimal` hides the marketing links — used
 * mid-checkout (/pay) and on staff/driver screens.
 */
export async function AppHeader({ navLabel = "Visit Site", navUrl = "/", minimal = false }: { navLabel?: string; navUrl?: string; minimal?: boolean }) {
  const user = await getCurrentUser();
  const accountUrl = user ? homeFor(user.role) : null;
  const shipmentsUrl = accountUrl ? `${accountUrl}#shipments` : "/user-account-creation?tab=login";

  return (
    <div data-collapse="none" role="banner" className="navbar-3 w-nav">
      <div className="wrap-5vw_sides">
        <div className="navbar-container-2">
          <Link href="/" className="navbar_logo-link w-nav-brand">
            <img src="/assets/img/logo-white.svg" alt="Coastal Parcel" className="image-16" />
          </Link>
          <NavMenuToggle
            menuClassName="navbar-menu w-nav-menu"
            buttonClassName="hamburger w-nav-button"
            button={
              <div className="hamburger_line-wrap">
                <div className="hamburger_line-top" />
                <div className="hamburger_line-middle">
                  <div className="hamburger_line-middle-in" />
                </div>
                <div className="hamburger_line-bottom" />
              </div>
            }
          >
            {!minimal && (
              <div className="auth-header-links">
                <Link href="/about" className="nav-link w-nav-link">About</Link>
                <Link href="/services" className="nav-link w-nav-link">Services</Link>
                <Link href="/contact" className="nav-link w-nav-link">Contact</Link>
                <ShipDropdown shipmentsUrl={shipmentsUrl} />
              </div>
            )}
            <div className="auth-header-account">
              {accountUrl ? (
                <Link href={accountUrl} className="shipnow-btn shipnow-btn-outline-inverse">My Account</Link>
              ) : (
                <>
                  <Link href="/user-account-creation?tab=login" className="shipnow-btn shipnow-btn-outline-inverse">Login</Link>
                  <Link href="/user-account-creation" className="shipnow-btn shipnow-btn-solid">Sign up</Link>
                </>
              )}
            </div>
            <Link href={navUrl} className="button_small nav w-button">{navLabel}</Link>
          </NavMenuToggle>
        </div>
      </div>
    </div>
  );
}
