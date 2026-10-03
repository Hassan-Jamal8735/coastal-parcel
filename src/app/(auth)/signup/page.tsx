import Link from "next/link";
import { redirect } from "next/navigation";
import { signupCustomer } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/dal";

export const metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { next } = await searchParams;

  return (
    <AuthShell title="Create your account" subtitle="Ship, pay, and track all your parcels in one place.">
      <AuthForm
        action={signupCustomer}
        next={next}
        submitLabel="Create account"
        fields={[
          { name: "name", label: "Full name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
          { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters", autoComplete: "new-password" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-bold text-ink underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
