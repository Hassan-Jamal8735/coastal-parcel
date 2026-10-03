import { redirect } from "next/navigation";
import { login, signupCustomer } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { AuthTabs } from "@/components/auth-tabs";
import { getCurrentUser, homeFor } from "@/lib/dal";

export const metadata = { title: "User Account Creation" };

export default async function UserAccountCreationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; redirect_to?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { tab, redirect_to, notice } = await searchParams;
  const guestSessionLost = notice === "guest_session_lost";

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Go back" />
      <AuthTabs
        variant="customer"
        defaultTab={tab === "login" || guestSessionLost ? "login" : "signup"}
        redirectTo={redirect_to}
        signupAction={signupCustomer}
        loginAction={login}
        notice={
          guestSessionLost && (
            <div className="auth-notice">
              We couldn&apos;t find your guest checkout session on this browser — it&apos;s usually just a cleared cookie or a different device. If
              you already made an account, log in below. Otherwise, your tracking number (from your confirmation email) always works to check
              your shipment&apos;s status, no account needed.
            </div>
          )
        }
      />
    </div>
  );
}
