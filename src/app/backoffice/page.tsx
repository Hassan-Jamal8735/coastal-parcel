import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "Backoffice" };

export default async function Backoffice() {
  const user = await requireRole("staff", "admin");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-bold">Backoffice</h1>
        <p className="mt-2 text-muted">Signed in as {user.name} ({user.role}).</p>
      </main>
    </>
  );
}
