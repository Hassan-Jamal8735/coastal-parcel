/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import { QuoteWidget } from "./quote-widget";

/** "Have questions? Talk to us!" + quote widget — shared by the home and services pages. */
export function TalkToUs() {
  return (
    <section className="section-3">
      <div id="Price-Estimation" className="div-block-9">
        <div className="div-block-10">
          <div className="div-block-11">
            <h2 className="heading-7">
              Have questions?
              <br />
              Talk to us!
            </h2>
            <p className="paragraph-5">
              Our support team is here to help with quotes, tracking, and shipping questions. Reach out and we&apos;ll get back to you fast.
              <br />
            </p>
          </div>
          <div className="div-block-12">
            <a href="https://wa.me/2347075836785" className="link-block-2 w-inline-block">
              <div className="div-block-13">
                <img src="/assets/img/icon-whatsapp-cta.png" loading="lazy" alt="" className="image-5" />
              </div>
              <p>Connect on whatsapp</p>
            </a>
            <a href="mailto:Info@coastalparcel.com?subject=You've%20got%20a%20mail" className="link-block-2 secondary w-inline-block">
              <div className="div-block-13 secondary">
                <img src="/assets/img/icon-email.png" loading="lazy" alt="" className="image-5" />
              </div>
              <p>Info@coastalparcel.com</p>
            </a>
          </div>
        </div>
        <div className="div-block-48 on-home-page">
          <QuoteWidget />
        </div>
      </div>
    </section>
  );
}
