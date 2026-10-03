import { WizardShell } from "@/components/wizard-shell";
import { formatMoney } from "@/lib/constants";
import { requireAccessibleShipment } from "@/lib/shipments";

export const metadata = { title: "Payment" };

// Placeholder until Phase 3 (Paystack/Stripe) lands.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await requireAccessibleShipment(id);
  return (
    <WizardShell step="Payment" international={s.pickupCountry !== s.deliveryCountry} title="Payment">
      <p className="text-muted">
        Shipment #{s.id} is confirmed. Amount due: <strong>{formatMoney(s.chargeAmount ?? s.priceAmount, s.chargeCurrency ?? "NGN")}</strong>.
        Online payment is being added next.
      </p>
    </WizardShell>
  );
}
