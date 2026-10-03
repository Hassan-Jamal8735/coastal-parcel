import { SiteHeader } from "./site-header";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="px-5 py-14">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mb-7 mt-2 text-muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </>
  );
}
