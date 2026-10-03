import * as z from "zod";
import { currencySymbol } from "@/lib/constants";
import { basePriceNgn, convertNgnTo, getPricingSettings, LocationError, locationDistanceKm } from "@/lib/pricing";

const schema = z.object({
  pricingMethod: z.enum(["location", "mileage"]).default("location"),
  weightKg: z.coerce.number().positive("Please enter a parcel weight greater than 0."),
  distanceKm: z.coerce.number().optional(),
  originCity: z.string().optional(),
  originCountry: z.string().optional(),
  destinationCity: z.string().optional(),
  destinationCountry: z.string().optional(),
  fulfillment: z.enum(["dropoff", "pickup"]).default("dropoff"),
  currency: z.string().default("NGN"),
});

/** Live quote — same server-side formula used when a shipment is actually saved. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;

  let distanceKm: number;
  let route: string;
  if (input.pricingMethod === "mileage") {
    if (!input.distanceKm || input.distanceKm <= 0) {
      return Response.json({ error: "Please enter a distance greater than 0." }, { status: 400 });
    }
    distanceKm = input.distanceKm;
    route = `${distanceKm} km`;
  } else {
    try {
      distanceKm = await locationDistanceKm(
        { city: input.originCity ?? "", country: input.originCountry ?? "" },
        { city: input.destinationCity ?? "", country: input.destinationCountry ?? "" },
      );
    } catch (e) {
      if (e instanceof LocationError) return Response.json({ error: e.message }, { status: 400 });
      throw e;
    }
    route = `${input.originCity}, ${input.originCountry} → ${input.destinationCity}, ${input.destinationCountry}`;
  }

  const rates = await getPricingSettings();
  let priceNgn = basePriceNgn(rates, input.weightKg, distanceKm);
  if (input.fulfillment === "pickup") priceNgn += rates.pickupFeeNgn;
  const currency = input.currency.toUpperCase();

  return Response.json({
    distanceKm: Math.round(distanceKm * 10) / 10,
    priceNgn: Math.round(priceNgn),
    displayAmount: Math.round((await convertNgnTo(priceNgn, currency)) * 100) / 100,
    currency,
    currencySymbol: currencySymbol(currency),
    ratePerKmNgn: rates.ratePerKmNgn,
    ratePerKgNgn: rates.ratePerKgNgn,
    fulfillment: input.fulfillment,
    route,
  });
}
