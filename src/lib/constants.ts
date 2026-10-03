// Shared business constants — ported 1:1 from the WordPress theme so labels,
// options, and status flow stay identical.

export const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Brazzaville)","Congo (DRC)","Costa Rica","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"] as const;

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  paid: "Paid",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed Delivery",
  returned: "Returned",
};
export const statusLabel = (s: string) => SHIPMENT_STATUS_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

/** Statuses during which a driver's live location is meaningful. */
export const ACTIVE_DELIVERY_STATUSES = ["assigned", "picked_up", "in_transit", "out_for_delivery"];

/** Forward-only steps a driver can advance a shipment through themselves. */
export const NEXT_DRIVER_STATUS: Record<string, string> = {
  assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "out_for_delivery",
  out_for_delivery: "delivered",
};

export const SERVICE_TYPES = {
  door_to_door: "Door to Door",
  air: "Air Logistics",
  land: "Land Logistics",
  ocean: "Ocean Logistics",
} as const;
export type ServiceType = keyof typeof SERVICE_TYPES;
export const serviceLabel = (t: string) => SERVICE_TYPES[t as ServiceType] ?? t;

export const SHIPMENT_PURPOSES = {
  gift: "Gift",
  sale_of_goods: "Sale of Goods",
  commercial_sample: "Commercial Sample",
  return_goods: "Return / Repair",
  personal_effects: "Personal Effects",
  documents: "Documents",
  other: "Other",
} as const;

export const PROHIBITED_ITEMS = [
  "Cash, currency, and negotiable instruments",
  "Firearms, ammunition, and explosives",
  "Illegal drugs and narcotics",
  "Perishable food and living organisms",
  "Flammable, corrosive, or hazardous materials",
  "Counterfeit goods",
  "Human remains or body parts",
  "Lottery tickets and gambling devices where prohibited by law",
];

export const CURRENCIES: Record<string, { name: string; symbol: string }> = {
  NGN: { name: "Nigerian Naira", symbol: "₦" },
  USD: { name: "US Dollar", symbol: "$" },
  GBP: { name: "British Pound", symbol: "£" },
  EUR: { name: "Euro", symbol: "€" },
  CAD: { name: "Canadian Dollar", symbol: "CA$" },
  AUD: { name: "Australian Dollar", symbol: "AU$" },
  ZAR: { name: "South African Rand", symbol: "R" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH₵" },
  KES: { name: "Kenyan Shilling", symbol: "KSh" },
  EGP: { name: "Egyptian Pound", symbol: "E£" },
  INR: { name: "Indian Rupee", symbol: "₹" },
  AED: { name: "UAE Dirham", symbol: "AED " },
};
export const currencySymbol = (c: string) => CURRENCIES[c.toUpperCase()]?.symbol ?? c.toUpperCase() + " ";

/** "Not sure about the size?" presets on the package step. */
export const BOX_PRESETS = [
  { key: "envelope", label: "Envelope", l: 30, w: 22, h: 2, weight: 0.5 },
  { key: "small", label: "Small Box", l: 35, w: 25, h: 15, weight: 3 },
  { key: "medium", label: "Medium Box", l: 45, w: 35, h: 25, weight: 7 },
  { key: "large", label: "Large Box", l: 60, w: 45, h: 35, weight: 15 },
];

export function formatMoney(amount: number, currency = "NGN") {
  return currencySymbol(currency) + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
