import Link from "next/link";
import { redirect } from "next/navigation";
import { signupDriver } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/dal";

export const metadata = { title: "Drive with us" };

export default async function DriverSignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <AuthShell title="Drive with Coastal Parcel" subtitle="Sign up as a delivery driver. Our team reviews every application before you can take deliveries.">
      <AuthForm
        action={signupDriver}
        submitLabel="Apply as a driver"
        fields={[
          { name: "name", label: "Full name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
          { name: "vehicleType", label: "Vehicle type", options: ["Motorcycle", "Car", "Van", "Truck"] },
          { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters", autoComplete: "new-password" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Already applied? <Link href="/login" className="font-bold text-ink underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
