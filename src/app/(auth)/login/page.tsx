import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/dal";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next, notice } = await searchParams;

  return (
    <AuthShell title="Log in" subtitle="Welcome back — log in to manage and track your shipments.">
      {notice === "guest_session_lost" && (
        <p className="mb-5 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
          We couldn&apos;t find your guest checkout on this browser — usually a cleared cookie or a different device. If you
          created an account, log in below. Otherwise, your tracking number always works to check your shipment&apos;s status.
        </p>
      )}
      <AuthForm
        action={login}
        next={next}
        submitLabel="Log in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-bold text-ink underline">Create an account</Link>
        <br />
        Driving for us? <Link href="/driver/signup" className="font-bold text-ink underline">Sign up as a driver</Link>
      </p>
    </AuthShell>
  );
}
