import type { ReactNode } from "react";
import { PublicHeader } from "./public-header";
import { SiteFooter } from "./site-footer";

/** Shell for the public marketing pages (WordPress header.php + footer.php). */
export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="full-wrapper">
      <PublicHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
