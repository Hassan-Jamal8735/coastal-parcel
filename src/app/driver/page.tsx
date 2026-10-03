import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "Driver dashboard" };

export default async function DriverDashboard() {
  const user = await requireRole("driver");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-bold">Hi {user.name}</h1>
        {user.driverStatus !== "approved" ? (
          <p className="mt-4 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3">
            Your driver application is <strong>{user.driverStatus}</strong>. You&apos;ll be able to take deliveries once our team approves it.
          </p>
        ) : (
          <p className="mt-2 text-muted">Your assigned shipments will appear here.</p>
        )}
      </main>
    </>
  );
}
