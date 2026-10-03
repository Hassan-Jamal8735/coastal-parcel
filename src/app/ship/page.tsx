import { redirect } from "next/navigation";
import { WizardShell } from "@/components/wizard-shell";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { canAccessShipment, getPackages, getShipment } from "@/lib/shipments";
import { ShipForm, type ShipFormInitial } from "./ship-form";

export const metadata = { title: "Shipment Details" };

export default async function ShipPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getCurrentUser();
  if (user && user.role !== "customer") redirect(homeFor(user.role));
  const q = await searchParams;

  let initial: ShipFormInitial;
  const editId = Number(q.edit);
  if (editId) {
    // Editable by its owner — the logged-in customer, or the guest whose
    // browser holds that shipment's checkout cookie.
    const s = await getShipment(editId);
    if (!s || !(await canAccessShipment(s))) redirect(user ? "/dashboard" : "/login?notice=guest_session_lost");
    if (s.status !== "draft") redirect(`/ship/${s.id}/pay`);
    const pkgs = await getPackages(s.id);
    initial = {
      id: s.id,
      fulfillment: s.fulfillment as "dropoff" | "pickup",
      shippingDate: s.shippingDate ?? "",
      isDocument: s.isDocument,
      senderName: s.senderName,
      senderPhone: s.senderPhone,
      senderEmail: s.senderEmail ?? "",
      pickupAddress: s.pickupAddress,
      pickupCity: s.pickupCity,
      pickupPostalCode: s.pickupPostalCode ?? "",
      pickupCountry: s.pickupCountry,
      receiverName: s.receiverName,
      receiverPhone: s.receiverPhone,
      deliveryAddress: s.deliveryAddress,
      deliveryCity: s.deliveryCity,
      deliveryPostalCode: s.deliveryPostalCode ?? "",
      deliveryCountry: s.deliveryCountry,
      packages: pkgs.map((p) => ({
        description: p.description ?? "",
        weight: String(p.weight),
        pieces: String(p.pieces),
        length: p.length?.toString() ?? "",
        width: p.width?.toString() ?? "",
        height: p.height?.toString() ?? "",
      })),
      shipmentPurpose: s.shipmentPurpose ?? "",
      shipmentReference: s.shipmentReference ?? "",
      pricingMethod: s.pricingMethod as "location" | "mileage",
      distanceKm: s.pricingMethod === "mileage" ? String(s.distanceKm ?? "") : "",
      notes: s.notes ?? "",
    };
  } else {
    // Fresh shipment — prefilled from a /ship-now quote hand-off when present.
    initial = {
      fulfillment: q.fulfillment === "pickup" ? "pickup" : "dropoff",
      shippingDate: new Date().toISOString().slice(0, 10),
      isDocument: false,
      senderName: user?.name ?? "",
      senderPhone: user?.phone ?? "",
      senderEmail: user?.email ?? "",
      pickupAddress: "",
      pickupCity: q.pickup_city ?? "",
      pickupPostalCode: q.pickup_postal ?? "",
      pickupCountry: q.pickup_country ?? "Nigeria",
      receiverName: "",
      receiverPhone: "",
      deliveryAddress: "",
      deliveryCity: q.delivery_city ?? "",
      deliveryPostalCode: q.delivery_postal ?? "",
      deliveryCountry: q.delivery_country ?? "",
      packages: [
        { description: "", weight: q.weight ?? "", pieces: q.pieces ?? "1", length: q.length ?? "", width: q.width ?? "", height: q.height ?? "" },
      ],
      shipmentPurpose: "",
      shipmentReference: "",
      pricingMethod: "location",
      distanceKm: "",
      notes:
        q.fulfillment === "pickup"
          ? "Requested: driver pickup from sender address."
          : q.fulfillment === "dropoff"
            ? "Requested: sender will drop off the parcel."
            : "",
    };
  }

  return (
    <WizardShell
      step="Details"
      title={initial.id ? "Update Shipment" : "Shipment Details"}
      subtitle={
        user
          ? "Tell us who's sending, who's receiving, and what's inside."
          : "No account needed — you can check out as a guest and create an account after paying."
      }
    >
      <ShipForm initial={initial} />
    </WizardShell>
  );
}
