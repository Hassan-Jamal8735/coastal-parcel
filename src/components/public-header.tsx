/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { NavMenuToggle, ShipDropdown } from "./nav-controls";

/** The marketing-site header (WordPress header.php). */
export async function PublicHeader() {
  const user = await getCurrentUser();
  const accountUrl = user ? homeFor(user.role) : null;
  const shipmentsUrl = accountUrl ? `${accountUrl}#shipments` : "/user-account-creation?tab=login";

  return (
    <div data-collapse="medium" role="banner" className="navbar w-nav">
      <div className="navbar-container">
        <Link href="/" className="brand w-nav-brand w--current">
          <img src="/assets/img/logo-white.svg" alt="Coastal Parcel" className="image-9" />
        </Link>

        <div className="center-nav">
          <Link href="/about" className="nav-link w-nav-link">About</Link>
          <Link href="/services" className="nav-link w-nav-link">Services</Link>
          <Link href="/contact" className="nav-link w-nav-link">Contact</Link>
          <ShipDropdown shipmentsUrl={shipmentsUrl} />
        </div>

        <NavMenuToggle menuClassName="nav-menu w-nav-menu" buttonClassName="menu-button w-nav-button" button={<div className="w-icon-nav-menu" />}>
          <div className="new-menu-nav">
            <Link href="/about" className="nav-link hide-right w-nav-link">About</Link>
            <Link href="/services" className="nav-link hide-right w-nav-link">Services</Link>
            <Link href="/contact" className="nav-link hide-right w-nav-link">Contact</Link>
            <Link href="/ship-now" className="nav-link hide-right w-nav-link">Get a Quote</Link>
            <Link href="/track-shipment" className="nav-link hide-right w-nav-link">Track a Shipment</Link>
            <Link href={shipmentsUrl} className="nav-link hide-right w-nav-link">My Shipments</Link>
            {accountUrl ? (
              <Link href={accountUrl} className="nav-button transparent w-button">My Account</Link>
            ) : (
              <Link href="/user-account-creation" className="nav-button transparent w-button">Sign Up/Log in</Link>
            )}
            <Link href="/contact" className="nav-button w-button">Contact</Link>
          </div>
        </NavMenuToggle>
      </div>
    </div>
  );
}
