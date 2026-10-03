"use client";

/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import Link from "next/link";
import { useState } from "react";

const TABS = [
  {
    label: "Air Logistics",
    icon: "tab-air-icon.png",
    heading: "We provide affordable Courier Transport.",
    text: "Fast, reliable air freight for time-sensitive shipments. We handle customs clearance and documentation so your cargo arrives on schedule, every time.",
    image: "service-air.jpg",
  },
  {
    label: "Land Logistics",
    icon: "tab-land-icon.png",
    heading: "We provide affordable Land logistics.",
    text: "Efficient road transport for domestic and cross-border deliveries, with flexible scheduling and full visibility from dispatch to destination.",
    image: "service-land.jpg",
  },
  {
    label: "Ocean Logistics",
    icon: "tab-ocean-icon.png",
    heading: "We provide affordable Ocean logistics",
    text: "Cost-effective sea freight for bulk and oversized shipments, backed by trusted carrier partnerships and dependable transit times.",
    image: "service-ocean.png",
  },
  {
    label: "Door Services",
    icon: "tab-door-icon.png",
    heading: "Top notch door to door services anywhere",
    text: "From your warehouse to your customer's doorstep, we manage the entire journey — pickup, transit, and final delivery — with zero hassle on your end.",
    image: "service-door.jpg",
  },
];

/** The "Professional Main Services" Webflow tabs on the home page. */
export function ServiceTabs() {
  const [current, setCurrent] = useState(0);
  return (
    <div className="tabs w-tabs">
      <div className="tabs-menu w-tab-menu" role="tablist">
        {TABS.map((t, i) => (
          <a
            key={t.label}
            role="tab"
            tabIndex={0}
            aria-selected={i === current}
            className={"tab-link-1 w-inline-block w-tab-link" + (i === current ? " w--current" : "")}
            onClick={() => setCurrent(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setCurrent(i)}
          >
            <div>{t.label}</div>
            <img src={`/assets/img/${t.icon}`} loading="lazy" alt="" className="image-3" />
          </a>
        ))}
      </div>
      <div className="tabs-content w-tab-content">
        {TABS.map((t, i) => (
          <div key={t.label} role="tabpanel" className={"w-tab-pane" + (i === current ? " w--tab-active" : "")}>
            <div className="panel-content-wrapper">
              <div className="div-block-7">
                <div className="div-block-8">
                  <h3 className="heading-4">{t.heading}</h3>
                  <p className="paragraph-4">{t.text}</p>
                </div>
                <Link href="/contact" className="main-button w-button">Contact us</Link>
              </div>
              <img src={`/assets/img/${t.image}`} loading="lazy" alt="" className="image-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
