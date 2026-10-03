"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shipments } from "@/db/schema";
import { CURRENCIES, SERVICE_TYPES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { calculateFinalPrice, convertNgnTo, deliveryEstimate, getPricingSettings } from "@/lib/pricing";
import { addTrackingEvent, canAccessShipment, getShipment, type Shipment } from "@/lib/shipments";

/** Every step's action re-checks access and that the shipment is still a draft. */
async function editableDraft(id: number): Promise<Shipment> {
  const s = await getShipment(id);
  if (!(await canAccessShipment(s))) redirect("/dashboard");
  if (s!.status !== "draft") redirect(`/ship/${id}/pay`);
  return s!;
}

async function reprice(s: Shipment, serviceType: string, addons: string[]) {
  const rates = await getPricingSettings();
  return calculateFinalPrice(rates, {
    weightKg: s.packageWeight,
    distanceKm: s.distanceKm ?? 0,
    fulfillment: s.fulfillment,
    serviceType,
    addons,
  });
}

export async function selectService(id: number, formData: FormData) {
  const s = await editableDraft(id);
  const serviceType = String(formData.get("serviceType") ?? "");
  if (!(serviceType in SERVICE_TYPES)) redirect(`/ship/${id}/options?error=choose`);

  const price = await reprice(s, serviceType, s.addons);
  await db
    .update(shipments)
    .set({
      serviceType,
      deliveryEstimate: deliveryEstimate(serviceType, s.pickupCountry === s.deliveryCountry),
      addonsTotalNgn: price.addonsTotal,
      priceAmount: price.finalPrice,
      updatedAt: new Date(),
    })
    .where(eq(shipments.id, id));
  redirect(`/ship/${id}/addons`);
}

export async function selectAddons(id: number, formData: FormData) {
  const s = await editableDraft(id);
  const rates = await getPricingSettings();
  const addons = formData.getAll("addons").map(String).filter((k) => k in rates.addons);

  const price = await reprice(s, s.serviceType, addons);
  await db
    .update(shipments)
    .set({ addons, addonsTotalNgn: price.addonsTotal, priceAmount: price.finalPrice, updatedAt: new Date() })
    .where(eq(shipments.id, id));

  // Customs paperwork only applies when crossing a border.
  redirect(s.pickupCountry !== s.deliveryCountry ? `/ship/${id}/customs` : `/ship/${id}/review`);
}

export async function confirmBooking(id: number, formData: FormData) {
  const s = await editableDraft(id);
  if (!s.serviceType) redirect(`/ship/${id}/options`);
  if (s.pickupCountry !== s.deliveryCountry && !s.customsItemDescription) redirect(`/ship/${id}/customs`);

  const currencyRaw = String(formData.get("currency") ?? "NGN").toUpperCase();
  const currency = currencyRaw in CURRENCIES ? currencyRaw : "NGN";
  // Snapshot the converted amount now, so the price can't drift between booking and paying.
  const chargeAmount = Math.round((await convertNgnTo(s.priceAmount, currency)) * 100) / 100;

  await db
    .update(shipments)
    .set({ status: "confirmed", chargeCurrency: currency, chargeAmount, updatedAt: new Date() })
    .where(eq(shipments.id, id));
  const user = await getCurrentUser();
  await addTrackingEvent(id, "confirmed", `Booking confirmed by customer. Paying in ${currency}.`, user?.id);
  redirect(`/ship/${id}/pay`);
}
