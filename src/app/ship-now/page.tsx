import { SiteHeader } from "@/components/site-header";
import { QuoteForm } from "./quote-form";

export const metadata = { title: "Get a Shipping Quote" };

export default async function ShipNowPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const prefill = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-4xl font-bold">Get a Shipping Quote</h1>
        <p className="mb-8 mt-2 text-muted">
          Instantly estimate your shipping cost, then continue straight into booking — no separate forms to fill in twice.
        </p>
        <QuoteForm prefill={prefill} />
      </main>
    </>
  );
}
