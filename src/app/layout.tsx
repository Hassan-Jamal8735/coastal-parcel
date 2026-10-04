/* eslint-disable @next/next/no-css-tags -- the original theme stylesheets are served unchanged from /public so the design stays identical */
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProgressBar } from "@/components/progress-bar";

export const metadata: Metadata = {
  title: { default: "Coastal Parcel", template: "%s – Coastal Parcel" },
  description: "Trusted global logistics, delivered with care. Get a quote, ship, and track parcels worldwide.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://coastalparcel.com"),
};

// Same stylesheets the WordPress theme loaded, in the same order, served
// unchanged from /public/assets — so the design is identical, not a rebuild.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US" className="w-mod-js">
      <head>
        <link rel="stylesheet" href="/assets/css/fonts.css" />
        <link rel="stylesheet" href="/assets/css/webflow.css" />
        <link rel="stylesheet" href="/assets/css/overrides.css" />
        <link rel="stylesheet" href="/assets/leaflet/leaflet.css" />
        <link rel="stylesheet" href="/assets/css/quote-widget.css" />
        <link rel="stylesheet" href="/assets/css/next.css" />
      </head>
      <body className="body">
        {/* Suspense: the bar reads the URL's search params on the client. */}
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
