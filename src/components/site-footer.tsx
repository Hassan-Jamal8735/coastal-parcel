/* eslint-disable @next/next/no-img-element -- original theme images, served as-is */
import Link from "next/link";

const SOCIAL = [
  ["https://www.facebook.com/61564512694592/", "icon-facebook.png"],
  ["#", "icon-twitter.png"],
  ["https://wa.me/2347075836785", "icon-whatsapp-footer.png"],
] as const;

/** WordPress footer.php. */
export function SiteFooter() {
  return (
    <section className="footer">
      <div className="footer-container">
        <div className="div-block-14">
          <div className="div-block-15">
            <img loading="lazy" src="/assets/img/logo-white.svg" alt="Coastal Parcel" className="image-7" />
            <p className="paragraph-6">Trusted global logistics, delivered with care.</p>
          </div>
          <div className="div-block-16">
            <h4 className="heading-5">Social links</h4>
            <div className="div-block-20">
              {SOCIAL.map(([href, icon]) => (
                <a key={icon} href={href} className="social-media-links w-inline-block">
                  <img loading="lazy" src={`/assets/img/${icon}`} alt="" className="image-8" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="div-block-16">
          <h4 className="heading-5">Our Company</h4>
          <div className="div-block-17">
            <Link href="/about" className="footer-link">About</Link>
            <Link href="/services" className="footer-link">Services</Link>
            <Link href="/contact" className="footer-link">Contact us</Link>
            <Link href="/track-shipment" className="footer-link">Track your order</Link>
            <Link href="/track-shipment" className="footer-link">Price Estimation</Link>
          </div>
        </div>

        <div className="div-block-16">
          <h4 className="heading-5">Helpful links</h4>
          <div className="div-block-17">
            <Link href="/privacy-policy" className="footer-link">Privacy policy</Link>
            <Link href="/terms" className="footer-link">Terms of service</Link>
            <Link href="/user-account-creation?tab=register" className="footer-link">Customer Sign up</Link>
            <Link href="/delivery-man-account-set-up" className="footer-link">Join as Deliveryman</Link>
          </div>
        </div>

        <div className="div-block-16">
          <div className="div-block-18">
            <h4 className="heading-5">Contact us</h4>
            <div className="div-block-17">
              <p className="footer-link no-hover">+234-8067802817</p>
              <p className="footer-link no-hover">+1-9293045177</p>
            </div>
          </div>
          <div className="div-block-18 xps">
            <h4 className="heading-5">Address:</h4>
            <p className="footer-link no-hover">3 Diffri Road Amikanle, Alagbado, lagos St, NG.</p>
          </div>
        </div>
      </div>

      <div className="div-block-19">
        <p className="mini-text">Copyright &copy; Coastal Parcel.</p>
        <p className="mini-text">All Rights Reserved.</p>
      </div>
    </section>
  );
}
