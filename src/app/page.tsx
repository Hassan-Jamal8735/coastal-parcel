import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main
        className="flex min-h-[70vh] items-center justify-center bg-cover bg-center px-5 text-center text-white"
        style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.6)),url(/img/hero-bg.jpg)" }}
      >
        <div>
          <h1 className="text-5xl font-bold md:text-7xl">
            We&apos;re global logistic providers<span className="text-brand">.</span>
          </h1>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/ship-now" className="rounded-lg bg-brand px-6 py-3 font-bold text-ink">Get a Quote</Link>
            <Link href="/track" className="rounded-lg border border-white/60 px-6 py-3 font-bold">Track a Shipment</Link>
          </div>
        </div>
      </main>
    </>
  );
}
