import "server-only";
import bwipjs from "bwip-js/node";
import { getCurrentUser } from "./dal";
import { canAccessShipment, type Shipment } from "./shipments";

import { PRINTABLE_STATUSES } from "./print-statuses";

/**
 * Who may print a shipment's label or receipt: office staff, the shipment's
 * own customer (or the guest on the browser that booked it), and the driver
 * it is assigned to.
 */
export async function canPrintShipment(s: Shipment | undefined) {
  if (!s || !s.trackingNumber || !PRINTABLE_STATUSES.includes(s.status)) return false;
  const user = await getCurrentUser();
  if (user && (user.role === "staff" || user.role === "admin")) return true;
  if (user?.role === "driver" && s.driverId === user.id) return true;
  return canAccessShipment(s);
}

/** Code 128 barcode of the tracking number, as an SVG string (scanner-readable). */
export function barcodeSvg(text: string) {
  return bwipjs.toSVG({ bcid: "code128", text, height: 14, scale: 3, includetext: false, paddingwidth: 0, paddingheight: 0 });
}

/** QR code (e.g. the tracking page link), as an SVG string. */
export function qrSvg(text: string) {
  return bwipjs.toSVG({ bcid: "qrcode", text, paddingwidth: 0, paddingheight: 0 });
}
