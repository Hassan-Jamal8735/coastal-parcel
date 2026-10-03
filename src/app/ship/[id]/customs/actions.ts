"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shipments } from "@/db/schema";
import { UploadError, uploadImage } from "@/lib/blob";
import { canAccessShipment, getShipment } from "@/lib/shipments";

export async function saveCustoms(id: number, formData: FormData) {
  const s = await getShipment(id);
  if (!(await canAccessShipment(s))) redirect("/dashboard");
  if (s!.status !== "draft") redirect(`/ship/${id}/pay`);

  const fail = (msg: string) => redirect(`/ship/${id}/customs?error=${encodeURIComponent(msg)}`);
  const description = String(formData.get("description") ?? "").trim();
  const countryOfOrigin = String(formData.get("countryOfOrigin") ?? "").trim();
  const declaredValue = Number(formData.get("declaredValue"));
  if (!description || !countryOfOrigin) fail("Please describe the item and its country of origin.");
  if (!(declaredValue > 0)) fail("Declared value must be greater than 0.");

  let signatureUrl: string | null = null;
  let logoUrl: string | null = null;
  try {
    signatureUrl = await uploadImage(formData.get("signature"), `customs/${id}`);
    logoUrl = await uploadImage(formData.get("logo"), `customs/${id}`);
  } catch (e) {
    if (e instanceof UploadError) fail(e.message);
    throw e;
  }

  await db
    .update(shipments)
    .set({
      customsItemDescription: description.slice(0, 255),
      customsCommodityCode: String(formData.get("commodityCode") ?? "").trim().slice(0, 50) || null,
      customsCountryOfOrigin: countryOfOrigin,
      customsDeclaredValueNgn: declaredValue,
      customsRemarks: String(formData.get("remarks") ?? "").trim() || null,
      customsElectronic: formData.get("electronic") === "on",
      // Keep the existing file when no new one was chosen.
      ...(signatureUrl && { customsSignatureUrl: signatureUrl }),
      ...(logoUrl && { customsLogoUrl: logoUrl }),
      updatedAt: new Date(),
    })
    .where(eq(shipments.id, id));

  redirect(`/ship/${id}/review`);
}
