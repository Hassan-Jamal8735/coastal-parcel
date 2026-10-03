import { redirect } from "next/navigation";
import { BookingLayout, ShipnowStepper } from "@/components/booking-layout";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { canAccessShipment, getPackages, getShipment } from "@/lib/shipments";
import { ShipForm, type ShipFormInitial } from "./ship-form";

export const metadata = { title: "Ship" };

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
    if (!s || !(await canAccessShipment(s))) redirect(user ? "/dashboard#shipments" : "/user-account-creation?tab=login&notice=guest_session_lost");
    if (s.status !== "draft") redirect(`/pay?shipment_id=${s.id}`);
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
    // A fresh shipment — prefilled from a /ship-now quote hand-off when present.
    initial = {
      fulfillment: q.fulfillment === "pickup" ? "pickup" : "dropoff",
      shippingDate: new Date().toISOString().slice(0, 10),
      isDocument: false,
      senderName: user?.name ?? "",
      senderPhone: user?.phone ?? "",
      senderEmail: user?.email ?? "",
      pickupAddress: "",
      pickupCity: q.pickup_city ?? "",
      pickupPostalCode: q.pickup_postal_code ?? "",
      pickupCountry: q.pickup_country || "Nigeria",
      receiverName: "",
      receiverPhone: "",
      deliveryAddress: "",
      deliveryCity: q.delivery_city ?? "",
      deliveryPostalCode: q.delivery_postal_code ?? "",
      deliveryCountry: q.delivery_country ?? "",
      packages: [
        {
          description: "",
          weight: q.package_weight ?? "",
          pieces: q.package_pieces || "1",
          length: q.package_length ?? "",
          width: q.package_width ?? "",
          height: q.package_height ?? "",
        },
      ],
      shipmentPurpose: "",
      shipmentReference: "",
      pricingMethod: q.pricing_method === "mileage" ? "mileage" : "location",
      distanceKm: q.distance_km ?? "",
      notes: q.fulfillment === "pickup" ? "Requested: driver pickup from sender address." : q.fulfillment ? "Requested: sender will drop off the parcel." : "",
    };
  }

  return (
    <BookingLayout active="ship">
      {!initial.id && <ShipnowStepper current={1} />}
      <h1 className="mb-20">{initial.id ? "Update Shipment" : "Shipment Details"}</h1>
      <p className="p-light">
        {initial.id
          ? "This shipment is still a draft, so you can change anything below before booking it."
          : "Fill in the details below — then choose your service, add any extras, and pay."}
      </p>
      {!user && (
        <div className="auth-notice">You don&apos;t need an account to fill this in &mdash; check out as a guest, and create an account after paying if you&apos;d like to track it from a dashboard.</div>
      )}
      <ShipForm initial={initial} isGuest={!user} />
    </BookingLayout>
  );
}
