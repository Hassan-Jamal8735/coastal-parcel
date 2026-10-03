import { AppHeader } from "@/components/app-header";
import { QuoteForm } from "./quote-form";

export const metadata = { title: "Ship Now" };

export default async function ShipNowPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const prefill = await searchParams;
  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" />
      <div className="shipnow-page">
        <div className="shipnow-container">
          <h1 className="shipnow-title">Get a Shipping Quote</h1>
          <p className="shipnow-subtitle">
            Instantly estimate your shipping cost, then continue straight into booking &mdash; no separate forms to fill in twice.
          </p>
          <QuoteForm prefill={prefill} />
        </div>
      </div>
    </div>
  );
}
