import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const quicksand = localFont({ src: "./fonts/quicksand-variable.woff2", variable: "--font-quicksand", weight: "300 700" });
const bricolage = localFont({ src: "./fonts/bricolage-grotesque-variable.woff2", variable: "--font-bricolage", weight: "200 800" });
const inconsolata = localFont({ src: "./fonts/inconsolata-variable.woff2", variable: "--font-inconsolata", weight: "400 700" });

export const metadata: Metadata = {
  title: { default: "Coastal Parcel — Worldwide Logistics", template: "%s — Coastal Parcel" },
  description: "Trusted global logistics, delivered with care. Get a quote, ship, and track parcels worldwide.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://coastalparcel.com"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${quicksand.variable} ${bricolage.variable} ${inconsolata.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
