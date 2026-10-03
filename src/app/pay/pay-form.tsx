"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { PayState } from "@/app/actions/payment";
import { PROHIBITED_ITEMS } from "@/lib/constants";

/**
 * Gateway choice + Terms checkbox + Accept and Pay. The button stays
 * disabled until Terms is ticked, and disables again while submitting so a
 * double-click can't start two checkouts.
 */
export function PayForm({
  action,
  paystack,
  stripe,
}: {
  action: (state: PayState, formData: FormData) => Promise<PayState>;
  paystack: boolean;
  stripe: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [accepted, setAccepted] = useState(false);
  const [showProhibited, setShowProhibited] = useState(false);
  const live = paystack || stripe;

  return (
    <form action={formAction}>
      {state?.error && <div className="auth-error">{state.error}</div>}

      {paystack && stripe ? (
        <div className="gateway-choice">
          <label className="gateway-choice-option">
            <input type="radio" name="gateway" value="paystack" defaultChecked />
            <span className="pay-gateway-info">
              <span className="pay-gateway-badge pay-gateway-paystack">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/img/brands/paystack-mark.svg" alt="" className="pay-gateway-logo" />
                Paystack
              </span>
              <span className="pay-gateway-desc">Cards, bank transfer &amp; USSD &mdash; NGN</span>
            </span>
          </label>
          <label className="gateway-choice-option">
            <input type="radio" name="gateway" value="stripe" />
            <span className="pay-gateway-info">
              <span className="pay-gateway-badge pay-gateway-stripe">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/img/brands/stripe.svg" alt="" className="pay-gateway-logo" />
                Stripe
              </span>
              <span className="pay-gateway-desc">Cards &mdash; USD</span>
            </span>
          </label>
        </div>
      ) : live ? (
        <p className="pay-gateway-powered">
          Secured by{" "}
          <span className={"pay-gateway-badge " + (paystack ? "pay-gateway-paystack" : "pay-gateway-stripe")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={paystack ? "/assets/img/brands/paystack-mark.svg" : "/assets/img/brands/stripe.svg"} alt="" className="pay-gateway-logo" />
            {paystack ? "Paystack" : "Stripe"}
          </span>
        </p>
      ) : null}

      <div className="pay-disclosure">
        <p>
          Your card will be charged the total amount shown above. Coastal Parcel will reweigh and re-measure your shipment to confirm the final charge &mdash; if it
          differs, you&apos;ll receive a separate adjustment charge referencing the same shipment number.
        </p>
        <p>You&apos;ll receive a payment receipt by email once payment is confirmed.</p>
      </div>

      <label className="shipnow-checkbox-row pay-terms-row">
        <input type="checkbox" name="terms_accepted" value="1" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          I accept the{" "}
          <a href="/terms" target="_blank" rel="noopener">
            Terms of Service
          </a>{" "}
          and confirm my shipment does not contain any{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowProhibited((v) => !v);
            }}
          >
            prohibited items
          </a>
          .
        </span>
      </label>
      {showProhibited && (
        <ul className="ship-prohibited-list">
          {PROHIBITED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <div className="spacer-20" />
      <div className="ship-wizard-actions">
        <Link href="/dashboard#shipments" className="button-2 outline w-button">
          Cancel
        </Link>
        <input type="submit" className="button-2 w-button" disabled={!accepted || pending} value={pending ? "Processing…" : live ? "Accept and Pay" : "Accept and Pay (Test Mode)"} />
      </div>
    </form>
  );
}
