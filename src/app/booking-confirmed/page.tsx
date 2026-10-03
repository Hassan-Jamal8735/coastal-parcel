import Link from "next/link";
import { redirect } from "next/navigation";
import { claimGuestShipment } from "@/app/actions/claim";
import { AppHeader } from "@/components/app-header";
import { CustomerSidebar } from "@/components/customer-sidebar";
import { requireAccessibleShipment } from "@/lib/shipments";
import { ClaimForm } from "./claim-form";

export const metadata = { title: "Booking Confirmed" };

export default async function BookingConfirmedPage({ searchParams }: { searchParams: Promise<{ shipment_id?: string }> }) {
  const { shipment_id } = await searchParams;
  const s = await requireAccessibleShipment(Number(shipment_id));
  if (s.status === "draft" || s.status === "confirmed") redirect(`/pay?shipment_id=${s.id}`);
  const isGuest = !s.customerId;

  return (
    <div className="full-wrapper">
      <AppHeader navLabel="Visit Site" />
      <div className="dashboard-shell">
        <CustomerSidebar active="shipments" />
        <main className="dashboard-main">
          <section className="ship-form-section">
            <div className="ship-form-card" style={{ textAlign: "center" }}>
              <h1 className="mb-20">Booking Confirmed!</h1>
              <p className="p-light">Your shipment has been booked and paid for. Use the tracking number below to follow its progress.</p>
              <div className="tracking-number-display">{s.trackingNumber}</div>
              <div className="spacer-20" />
              <Link href={`/track-shipment?tracking=${s.trackingNumber}`} className="button-2 w-button">
                Track This Shipment
              </Link>
              {!isGuest && (
                <>
                  <div className="spacer-20" />
                  <Link href="/dashboard#shipments" className="p-light" style={{ textDecoration: "underline" }}>
                    Back to My Shipments
                  </Link>
                </>
              )}
            </div>
            {isGuest && <ClaimForm action={claimGuestShipment.bind(null, s.id)} name={s.senderName} email={s.senderEmail ?? ""} />}
          </section>
        </main>
      </div>
    </div>
  );
}
