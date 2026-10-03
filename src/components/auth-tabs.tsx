"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AuthFormState } from "@/app/actions/auth";
import { PasswordInput } from "./password-input";

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

function ErrorBox({ state }: { state: AuthFormState }) {
  return state?.error ? <div className="auth-error">{state.error}</div> : null;
}

/**
 * The Sign Up / Log In tabbed card (WordPress page-user-account-creation.php
 * and page-delivery-man-account-set-up.php), with the original Webflow
 * tab markup so the CSS styles it identically.
 */
export function AuthTabs({
  variant,
  defaultTab,
  redirectTo,
  notice,
  signupAction,
  loginAction,
}: {
  variant: "customer" | "driver";
  defaultTab: "signup" | "login";
  redirectTo?: string;
  notice?: React.ReactNode;
  signupAction: Action;
  loginAction: Action;
}) {
  const [tab, setTab] = useState(defaultTab);
  const [signupState, signup, signingUp] = useActionState(signupAction, undefined);
  const [loginState, login, loggingIn] = useActionState(loginAction, undefined);
  const driver = variant === "driver";

  return (
    <section className="section_big">
      <div className="img_banner" />
      <div className="modal">
        {driver && <h2 className="heading-32">Delivery Manager Service</h2>}
        <div className="w-tabs">
          <div className="tab-menu w-tab-menu">
            <a
              href="#"
              onClick={(e) => (e.preventDefault(), setTab("signup"))}
              className={"tab-link w-inline-block w-tab-link" + (tab === "signup" ? " w--current" : "")}
            >
              <div className="text_tab">Sign Up</div>
              <div className="toggle" />
            </a>
            <a
              href="#"
              onClick={(e) => (e.preventDefault(), setTab("login"))}
              className={"tab-link w-inline-block w-tab-link" + (tab === "login" ? " w--current" : "")}
            >
              <div className="text_tab">Log In</div>
            </a>
          </div>
          <div className="w-tab-content">
            <div className={"w-tab-pane" + (tab === "signup" ? " w--tab-active" : "")}>
              <div className="form-block-2 w-form">
                <form action={signup} className="form-2">
                  <h1 className="mb-20">Create your account</h1>
                  <p className="p-light">{driver ? "Apply to become a Coastal Parcel delivery driver." : "Create a free account to book and track shipments."}</p>
                  <ErrorBox state={signupState} />
                  {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
                  <div className="form-field">
                    <div className="label">Full Name</div>
                    <input className="field w-input" maxLength={256} name="full_name" placeholder="Your full name" type="text" required />
                  </div>
                  <div className="form-field">
                    <div className="label">Email</div>
                    <input className="field w-input" maxLength={256} name="email" placeholder="johndoe@gmail.com" type="email" required />
                  </div>
                  <div className="form-field">
                    <div className="label">{driver ? "Telephone Number" : "Phone Number"}</div>
                    <input className="field w-input" maxLength={256} name="phone" placeholder="0800 000 0000" type="tel" required />
                  </div>
                  {driver && (
                    <div className="form-field">
                      <div className="label">Vehicle Type</div>
                      <select className="field w-select" name="vehicle_type" required defaultValue="">
                        <option value="" disabled>Select vehicle type</option>
                        <option value="motorcycle">Motorcycle</option>
                        <option value="car">Car</option>
                        <option value="van">Van</option>
                        <option value="truck">Truck</option>
                      </select>
                    </div>
                  )}
                  <div className="form-field">
                    <div className="label">Password</div>
                    <PasswordInput className="field w-input" maxLength={256} name="password" placeholder="Password" minLength={8} required />
                  </div>
                  <div className="spacer-20" />
                  <input type="submit" className="button-2 w-button" value={signingUp ? "Please wait…" : "Continue"} disabled={signingUp} />
                </form>
              </div>
            </div>

            <div className={"w-tab-pane" + (tab === "login" ? " w--tab-active" : "")}>
              <div className="form-block-2 w-form">
                <form action={login} className="form-2">
                  <h1 className="mb-20">Log in</h1>
                  <p className="p-light">{driver ? "Enter your credentials to log in to your driver account." : "Enter your credentials to log in to our platform."}</p>
                  {notice}
                  <ErrorBox state={loginState} />
                  {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
                  <div className="form-field">
                    <div className="label">Email</div>
                    <input className="field w-input" maxLength={256} name="email" placeholder="johndoe@gmail.com" type="email" required />
                  </div>
                  <div className="form-field">
                    <div className="label">Password</div>
                    <PasswordInput className="field w-input" maxLength={256} name="password" placeholder="Password" required />
                  </div>
                  <div className="spacer-20" />
                  <input type="submit" className="button-2 w-button" value={loggingIn ? "Please wait…" : "Continue"} disabled={loggingIn} />
                </form>
              </div>
            </div>
          </div>
        </div>
        <p className="auth-role-switch">
          {driver ? (
            <>
              Looking to ship a package instead? <Link href="/user-account-creation">Sign up as a customer</Link>.
            </>
          ) : (
            <>
              Looking to drive for us? <Link href="/delivery-man-account-set-up">Sign up as a driver</Link> instead.
            </>
          )}
        </p>
      </div>
      <div className="disclaimer">Copyright Coastal Parcel {new Date().getFullYear()}. All rights reserved.</div>
    </section>
  );
}
