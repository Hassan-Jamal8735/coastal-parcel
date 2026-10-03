/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import { MarketingPage } from "@/components/marketing-page";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact" };

/** WordPress page-contact.php. */
export default function ContactPage() {
  return (
    <MarketingPage>
      <section className="contact-hero">
        <div className="ch-container">
          <h2 className="heading-13">Reach out to us</h2>
          <p className="paragraph-12">Our expertise ensures efficient and seamless operations, tailored to meet your specific needs and get your parcels delivered.</p>
        </div>
      </section>

      <section className="information-section">
        <div className="ci-container">
          <img src="/assets/img/service-air.jpg" loading="lazy" alt="" className="image-13" />
          <div className="div-block-34">
            <div className="div-block-35">
              <h2 className="heading-14">
                Get in touch with us
                <br />
                anytime from anywhere
              </h2>
              <div className="div-block-36" />
            </div>
            <div className="div-block-37">
              <div className="info-wrapper">
                <h4 className="info-title">Support center 24/7</h4>
                <p className="paragraph-13">+1-9293045177</p>
                <p className="paragraph-13">+234-8067802817</p>
              </div>
              <div className="div-block-38">
                <div className="info-wrapper xps">
                  <h4 className="info-title">Office address</h4>
                  <p className="info-text">3 Diffri Road Amikanle, Alagbado, lagos St, NG.</p>
                </div>
                <div className="info-wrapper">
                  <h4 className="info-title">Email Address</h4>
                  <p className="info-text">
                    Info@coastalparcel.com
                    <br />
                  </p>
                </div>
              </div>
              <a href="https://wa.me/2347075836785" className="link-block-2 w-inline-block">
                <div className="div-block-13">
                  <img src="/assets/img/icon-whatsapp-cta.png" loading="lazy" alt="" className="image-5" />
                </div>
                <p>Connect on Whatsapp</p>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="div-block-39">
          <div className="div-block-40">
            <h2 className="heading-15">Send a message</h2>
            <p className="paragraph-14">
              We appreciate your interest please complete the form below and we will contact you to discuss your warehousing, distribution, air, ocean freight or any
              other logistics needs.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </MarketingPage>
  );
}
