import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingLayout } from "@/components/booking-layout";
import { getCurrentUser } from "@/lib/dal";
import { finalizePaidShipment, paystackReady, stripeReady, verifyPaystack, verifyStripe } from "@/lib/payments";
import { requireAccessibleShipment } from "@/lib/shipments";

export const metadata = { title: "Payment Callback" };

/**
 * Paystack/Stripe redirect here after checkout. The transaction is verified
 * server-side before the shipment is marked paid — never on the redirect alone.
 */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment_id?: string; gateway?: string; reference?: string; session_id?: string }>;
}) {
  const q = await searchParams;
  const s = await requireAccessibleShipment(Number(q.shipment_id));
  if (!["draft", "confirmed"].includes(s.status)) redirect(`/booking-confirmed?shipment_id=${s.id}`);

  let error = "Missing payment reference.";
  const user = await getCurrentUser();
  if (q.gateway === "stripe" && q.session_id && stripeReady()) {
    const result = await verifyStripe(q.session_id, s.id);
    if (result.ok) {
      await finalizePaidShipment(s.id, "stripe", q.session_id, `Payment received via Stripe. Session: ${q.session_id}`, user?.id, result);
      redirect(`/booking-confirmed?shipment_id=${s.id}`);
    }
    error = result.error;
  } else if (q.reference && paystackReady()) {
    const result = await verifyPaystack(q.reference, s.id);
    if (result.ok) {
      await finalizePaidShipment(s.id, "paystack", q.reference, `Payment received via Paystack. Reference: ${q.reference}`, user?.id, result);
      redirect(`/booking-confirmed?shipment_id=${s.id}`);
    }
    error = result.error;
  }

  return (
    <BookingLayout active="shipments" minimalHeader cardStyle={{ textAlign: "center" }}>
      <h1 className="mb-20">Payment Not Confirmed</h1>
      <div className="auth-error">{error}</div>
      <p className="p-light">If you completed payment, please contact support with your shipment ID: #{s.id}.</p>
      <Link href={`/pay?shipment_id=${s.id}`} className="button-2 w-button">
        Try Again
      </Link>
    </BookingLayout>
  );
}
