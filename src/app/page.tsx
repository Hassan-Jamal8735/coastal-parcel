/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import Link from "next/link";
import { MarketingPage } from "@/components/marketing-page";
import { ServiceTabs } from "@/components/service-tabs";
import { TalkToUs } from "@/components/talk-to-us";

const BRANDS = ["brand-global.png", "brand-logista.png", "brand-express-logistic.png", "brand-fastsh.png", "brand-drone.png", "brand-deliver.png", "brand-5.png", "brand-expres.png"];

/** Home page (WordPress front-page.php). */
export default function HomePage() {
  return (
    <MarketingPage>
      <section className="hero-section">
        <div className="hero-container">
          <h1 className="heading">
            We&rsquo;re global logistic providers<span className="text-span">.</span>
          </h1>
          <div className="cta-wrappers">
            <div className="div-block-2">
              <a href="#Price-Estimation" className="link-block w-inline-block">
                <img src="/assets/img/cta-quote.png" loading="lazy" alt="" className="image _40" />
                <p className="cta-button-text">QUOTE</p>
              </a>
              <Link href="/ship" className="div-block-3 w-inline-block">
                <img src="/assets/img/cta-ship.png" loading="lazy" alt="" className="image" />
                <p className="cta-button-text">SHIP</p>
              </Link>
              <Link href="/user-account-creation?tab=register" className="link-block-3 w-inline-block">
                <img src="/assets/img/cta-signup.png" loading="lazy" alt="" className="image _40" />
                <p className="paragraph-7">SIGN UP</p>
              </Link>
            </div>
            <form action="/track-shipment" method="get" className="search w-form">
              <label htmlFor="search" className="field-label">Search</label>
              <input className="search-input w-input" maxLength={256} name="tracking" placeholder="Your Tracking Code" type="search" id="search" required />
              <input type="submit" className="search-button w-button" value="Track" />
            </form>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="brand-container">
          {[0, 1].map((row) => (
            <div key={row} className="icon-wrapper">
              {BRANDS.map((b) => (
                <img key={b} src={`/assets/img/${b}`} loading="lazy" alt="" className="image-2" />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="info">
        <div className="info-container">
          <div className="why-headline">
            <h2 className="heading-6">Why Coastal Parcel are the best in the world</h2>
            <p className="paragraph">We combine speed, reliability, and round-the-clock tracking to move your goods safely &mdash; wherever they need to go.</p>
          </div>
          <div className="why-wrapper">
            <div className="why-block">
              <div className="div-block-4">
                <div className="highlighter-vertical" />
                <h3 className="heading-3">Safe Delivery</h3>
              </div>
              <p className="paragraph-3">
                Every parcel is handled with care from pickup to drop-off, with secure packaging standards and real-time monitoring to keep your shipment protected at
                every step.
              </p>
            </div>
            <div className="why-block">
              <div className="div-block-4">
                <div className="highlighter-vertical" />
                <h3 className="heading-3">Ship Globally</h3>
              </div>
              <p className="paragraph-3">
                Our network spans air, land, and ocean routes across dozens of countries, so you can reach customers and partners anywhere in the world without delays.
                <br />
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="section-2">
        <div className="div-block-5">
          <div className="div-block-6">
            <h2 className="heading-2">Professional Main Services</h2>
            <p className="paragraph-2">We provide services in the field of Air, Land, Ocean Logistics and a full range of Door to Door services</p>
          </div>
          <ServiceTabs />
        </div>
      </section>

      <TalkToUs />
    </MarketingPage>
  );
}
