import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSessionUser, homeFor } from "@/lib/dal";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ redirect_to?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/user-account-creation?tab=login");
  if (user.emailVerifiedAt) redirect(homeFor(user.role));
  const { redirect_to } = await searchParams;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Go back" />
      <section className="section_big">
        <div className="img_banner" />
        <div className="modal">
          <VerifyForm email={user.email} redirectTo={redirect_to} />
        </div>
      </section>
    </div>
  );
}
