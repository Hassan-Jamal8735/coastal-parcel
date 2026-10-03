import Link from "next/link";
import { MarketingPage } from "@/components/marketing-page";

export const metadata = { title: "FAQ" };

/** WordPress page-faq.php. */
export default function FaqPage() {
  return (
    <MarketingPage>
      <section className="legal-pages-hero">
        <div className="div-block-43">
          <h2 className="heading-16">Frequently Asked Questions</h2>
          <p className="paragraph-15">Answers to common questions about shipping, tracking, and pricing with Coastal Parcel.</p>
        </div>
      </section>

      <section className="legal-content-section">
        <div className="div-block-44">
          <div className="legal-heading-and-text">
            <h3 className="heading-17">How do I track my shipment?</h3>
            <p className="paragraph-16">
              Enter your tracking code on the <Link href="/track-shipment">Track Shipment</Link> page to see real-time status updates, from pickup to final delivery.
            </p>
          </div>
          <div className="legal-heading-and-text">
            <h3 className="heading-17">How is my shipping cost calculated?</h3>
            <p className="paragraph-16">
              Pricing is based on either distance and parcel weight, or a flat domestic/international rate plus weight, depending on the shipping method you choose.
              Use the quote calculator on the Track page to get an instant estimate.
            </p>
          </div>
          <div className="legal-heading-and-text">
            <h3 className="heading-17">What shipping methods do you offer?</h3>
            <p className="paragraph-16">We offer Air, Land, and Ocean logistics, along with full Door-to-Door service covering pickup through final delivery.</p>
          </div>
          <div className="legal-heading-and-text">
            <h3 className="heading-17">Do you ship internationally?</h3>
            <p className="paragraph-16">Yes, our network covers air, land, and ocean routes across dozens of countries.</p>
          </div>
          <div className="legal-heading-and-text">
            <h3 className="heading-17">How do I get in touch with support?</h3>
            <p className="paragraph-16">
              Reach us via WhatsApp, email, or the <Link href="/contact">Contact</Link> page, and our support team will respond promptly.
            </p>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
