import { MarketingPage } from "./marketing-page";

const SECTIONS = [
  ["License", "All content on this website, including logos, graphics, and text, is the property of Coastal Parcel and may not be reproduced without permission."],
  ["Security", "We use industry-standard measures to protect your personal and shipment data from unauthorized access, loss, or misuse."],
  ["Agreement", "By using our website or services, you agree to the terms outlined in this policy. If you do not agree, please discontinue use of our services."],
  ["Changes about terms", "We may update this policy periodically. Continued use of our services after changes are posted constitutes acceptance of the revised terms."],
  ["Logistics", "This section covers how we handle shipment tracking data, delivery information, and communications related to your orders."],
  ["Privacy", "We collect only the information necessary to process your shipments and will never sell your data to third parties."],
];

/** Terms & Privacy share one layout and body (WordPress page-terms.php / page-privacy-policy.php). */
export function LegalPage({ title, subtitle, docName }: { title: string; subtitle: string; docName: string }) {
  return (
    <MarketingPage>
      <section className="legal-pages-hero">
        <div className="div-block-43">
          <h2 className="heading-16">{title}</h2>
          <p className="paragraph-15 last-updated">Last Updated: 18th July, 2026</p>
          <p className="paragraph-15">{subtitle}</p>
        </div>
      </section>

      <section className="legal-content-section">
        <div className="div-block-44">
          <p className="paragraph-16">This {docName} explains how Coastal Parcel collects, uses, and protects your information when you use our website and shipping services.</p>
          {SECTIONS.map(([heading, text]) => (
            <div key={heading} className="legal-heading-and-text">
              <h3 className="heading-17">{heading}</h3>
              <p className="paragraph-16">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
