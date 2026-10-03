import { redirect } from "next/navigation";
import { login, signupDriver } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { AuthTabs } from "@/components/auth-tabs";
import { getSessionUser, homeFor } from "@/lib/dal";

export const metadata = { title: "Delivery Man Account Set Up" };

export default async function DeliveryManAccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(user.emailVerifiedAt ? homeFor(user.role) : "/verify-email");
  const { tab } = await searchParams;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Go back" />
      <AuthTabs variant="driver" defaultTab={tab === "login" ? "login" : "signup"} signupAction={signupDriver} loginAction={login} />
    </div>
  );
}
