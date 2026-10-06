"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { shipmentPackages, shipments } from "@/db/schema";
import { SHIPMENT_PURPOSES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { calculateFinalPrice, getPricingSettings, haversineKm, LocationError, locationDistanceKm } from "@/lib/pricing";
import { aggregatePackages, canAccessShipment, getShipment, newGuestToken, setGuestCookie } from "@/lib/shipments";
import { normalizePhone } from "@/lib/phone";

const optionalNumber = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable());

const packageSchema = z.object({
  description: z.string().trim().max(191).default(""),
  weight: z.coerce.number().positive("Every package needs a weight greater than 0."),
  pieces: z.coerce.number().int().min(1).default(1),
  length: optionalNumber,
  width: optionalNumber,
  height: optionalNumber,
});

const pinSchema = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .nullable()
  .default(null);

const shipmentSchema = z.object({
  id: z.number().int().positive().optional(),
  fulfillment: z.enum(["dropoff", "pickup"]).default("dropoff"),
  shippingDate: z.string().optional(),
  isDocument: z.boolean().default(false),
  senderName: z.string().trim().min(1, "Please enter the sender's name."),
  senderPhone: z.string().trim().refine((v) => normalizePhone(v) !== null, "Please enter a valid sender phone number (digits only, optional + country code).").transform((v) => normalizePhone(v)!),
  senderEmail: z.email("Please enter a valid sender email — it's used for your receipt and checkout.").trim(),
  pickupAddress: z.string().trim().min(1, "Please enter the pickup address."),
  pickupCity: z.string().trim().min(1, "Please enter the pickup city."),
  pickupPostalCode: z.string().trim().max(20).default(""),
  pickupCountry: z.string().trim().min(1, "Please choose the pickup country."),
  receiverName: z.string().trim().min(1, "Please enter the receiver's name."),
  receiverPhone: z.string().trim().refine((v) => normalizePhone(v) !== null, "Please enter a valid receiver phone number (digits only, optional + country code).").transform((v) => normalizePhone(v)!),
  deliveryAddress: z.string().trim().min(1, "Please enter the delivery address."),
  deliveryCity: z.string().trim().min(1, "Please enter the delivery city."),
  deliveryPostalCode: z.string().trim().max(20).default(""),
  deliveryCountry: z.string().trim().min(1, "Please choose the delivery country."),
  pickupPin: pinSchema,
  deliveryPin: pinSchema,
  packages: z.array(packageSchema).min(1, "Please add at least one package."),
  shipmentPurpose: z.string().refine((v) => v in SHIPMENT_PURPOSES, "Please choose the purpose of your shipment."),
  shipmentReference: z.string().trim().max(191).default(""),
  pricingMethod: z.enum(["location", "mileage"]).default("location"),
  distanceKm: z.coerce.number().optional(),
  notes: z.string().trim().max(2000).default(""),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

export async function saveShipment(input: ShipmentInput): Promise<{ error: string }> {
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const user = await getCurrentUser();
  if (user && user.role !== "customer") return { error: "Please use a customer account to create shipments." };

  let existing;
  if (data.id) {
    // Editing is for the draft's owner: the logged-in customer, or the guest holding its checkout cookie.
    existing = await getShipment(data.id);
    if (!existing || !(await canAccessShipment(existing))) return { error: "Shipment not found." };
    if (existing.status !== "draft") return { error: "This shipment has already been booked and can no longer be edited." };
  }

  let distanceKm: number;
  if (data.pricingMethod === "mileage") {
    if (!data.distanceKm || data.distanceKm <= 0) return { error: "Please enter a valid distance for manual-distance pricing." };
    distanceKm = data.distanceKm;
  } else if (data.pickupPin && data.deliveryPin) {
    // Both exact spots pinned: measure between them rather than city centres.
    distanceKm = haversineKm(data.pickupPin, data.deliveryPin);
  } else {
    try {
      distanceKm = await locationDistanceKm(
        { city: data.pickupCity, country: data.pickupCountry },
        { city: data.deliveryCity, country: data.deliveryCountry },
      );
    } catch (e) {
      if (e instanceof LocationError) return { error: e.message };
      throw e;
    }
  }

  const packages = data.packages.map((p) =>
    data.isDocument ? { ...p, length: null, width: null, height: null } : p,
  );
  const totals = aggregatePackages(packages);
  const fulfillment = existing?.fulfillment ?? data.fulfillment;
  const rates = await getPricingSettings(data.pickupCountry);
  const price = calculateFinalPrice(rates, {
    weightKg: totals.packageWeight,
    distanceKm,
    fulfillment,
    serviceType: existing?.serviceType || undefined,
    addons: existing?.addons ?? [],
  });

  const values = {
    fulfillment,
    pricingMethod: data.pricingMethod,
    shippingDate: data.shippingDate || null,
    isDocument: data.isDocument,
    senderName: data.senderName,
    senderPhone: data.senderPhone,
    senderEmail: data.senderEmail.toLowerCase(),
    pickupAddress: data.pickupAddress,
    pickupCity: data.pickupCity,
    pickupPostalCode: data.pickupPostalCode || null,
    pickupCountry: data.pickupCountry,
    receiverName: data.receiverName,
    receiverPhone: data.receiverPhone,
    deliveryAddress: data.deliveryAddress,
    deliveryCity: data.deliveryCity,
    deliveryPostalCode: data.deliveryPostalCode || null,
    deliveryCountry: data.deliveryCountry,
    pickupLat: data.pickupPin?.lat ?? null,
    pickupLng: data.pickupPin?.lng ?? null,
    deliveryLat: data.deliveryPin?.lat ?? null,
    deliveryLng: data.deliveryPin?.lng ?? null,
    ...totals,
    shipmentPurpose: data.shipmentPurpose,
    shipmentReference: data.shipmentReference || null,
    notes: data.notes || null,
    distanceKm: Math.round(distanceKm * 10) / 10,
    addonsTotalNgn: price.addonsTotal,
    priceAmount: price.finalPrice,
    updatedAt: new Date(),
  };

  let shipmentId: number;
  if (existing) {
    await db.update(shipments).set(values).where(eq(shipments.id, existing.id));
    shipmentId = existing.id;
  } else {
    const guestToken = user ? null : newGuestToken();
    const [row] = await db
      .insert(shipments)
      .values({ ...values, customerId: user?.id ?? null, guestToken })
      .returning({ id: shipments.id });
    shipmentId = row.id;
    if (guestToken) await setGuestCookie(shipmentId, guestToken);
  }

  // Replace the itemized breakdown wholesale — simplest correct handling
  // of rows being added, removed, or reordered.
  await db.delete(shipmentPackages).where(eq(shipmentPackages.shipmentId, shipmentId));
  await db.insert(shipmentPackages).values(
    packages.map((p, i) => ({ shipmentId, ...p, description: p.description || null, sortOrder: i })),
  );

  redirect(`/shipping-options?shipment_id=${shipmentId}`);
}
