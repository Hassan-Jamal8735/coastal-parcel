/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import { MarketingPage } from "@/components/marketing-page";

export const metadata = { title: "About" };

/** WordPress page-about.php. */
export default function AboutPage() {
  return (
    <MarketingPage>
      <section className="about-hero">
        <div className="about-hero-container">
          <div className="div-block-22">
            <h2 className="heading-8">Story Behind Our Company</h2>
            <p className="paragraph-8">
              Coastal Parcel started with a simple goal: make shipping across borders as easy as shipping across town. What began as a small courier operation has
              grown into a full logistics partner, moving goods by air, land, and sea for businesses and individuals who need their parcels handled with speed and
              care.
              <br />
            </p>
          </div>
          <div className="div-block-23">
            <div className="left-image-container">
              <div className="image-11" />
              <div className="image-12" />
            </div>
            <img src="/assets/img/about-5.jpg" loading="lazy" alt="" className="image-10" />
            <div className="left-image-container">
              <div className="image-11 xps" />
              <div className="image-12 xps" />
            </div>
          </div>
        </div>
      </section>

      <section className="section-4">
        <div className="div-block-24">
          <div className="div-block-26">
            <div className="div-block-27">
              <div className="impact-highlight">
                <h1 className="heading-10">185</h1>
                <p className="paragraph-10">Tons of Goods</p>
              </div>
              <div className="div-block-28">
                <div className="impact-highlight">
                  <h1 className="heading-10">24</h1>
                  <p className="paragraph-10">Countries covered</p>
                </div>
                <div className="impact-highlight">
                  <h1 className="heading-10">220</h1>
                  <p className="paragraph-10">Packages delivered</p>
                </div>
              </div>
            </div>
          </div>
          <div className="div-block-25">
            <h2 className="heading-9">
              Our Impact in
              <br />
              Numbers is amazing
            </h2>
            <p className="paragraph-9">
              These numbers reflect years of building trust one delivery at a time &mdash; every shipment tracked, every customer kept in the loop, every route
              optimized for speed and reliability.
            </p>
          </div>
        </div>
      </section>

      <section className="our-mission">
        <div className="div-block-29">
          <div className="div-block-33">
            <div className="image-anchor" />
            <div className="image-anchor _2" />
          </div>
          <div className="div-block-30">
            <h2 className="heading-12">Our Mission</h2>
            <div className="div-block-31">
              <div className="div-block-32">
                <h4 className="heading-11">The Mission</h4>
                <p className="paragraph-11">To make global shipping simple, transparent, and accessible for businesses of every size.</p>
              </div>
              <div className="div-block-32">
                <h4 className="heading-11">Our Drive &amp; Vision</h4>
                <p className="paragraph-11">We&apos;re driven by the belief that distance shouldn&apos;t be a barrier to doing business &mdash; anywhere in the world.</p>
              </div>
              <div className="div-block-32">
                <h4 className="heading-11">Our Goal</h4>
                <p className="paragraph-11">To become the most trusted name in cross-border logistics, one satisfied customer at a time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
