import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "My account" };

export default async function CustomerDashboard() {
  const user = await requireRole("customer");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-bold">Welcome, {user.name}</h1>
        <p className="mt-2 text-muted">Your shipments will appear here.</p>
      </main>
    </>
  );
}
