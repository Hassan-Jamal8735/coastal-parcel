import { MarketingPage } from "@/components/marketing-page";
import { ServiceTabs } from "@/components/service-tabs";
import { TalkToUs } from "@/components/talk-to-us";

export const metadata = { title: "Services" };

/** WordPress page-services.php. */
export default function ServicesPage() {
  return (
    <MarketingPage>
      <section id="services" className="section-2 services-page">
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
