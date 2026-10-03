import {
  bigserial,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "driver", "staff", "admin"]);
export const driverStatus = pgEnum("driver_status", ["pending", "approved", "rejected"]);

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: varchar("email", { length: 191 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 191 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    role: userRole("role").notNull().default("customer"),
    // Drivers only.
    vehicleType: varchar("vehicle_type", { length: 50 }),
    driverStatus: driverStatus("driver_status"),
    lastLat: numeric("last_lat", { precision: 10, scale: 7, mode: "number" }),
    lastLng: numeric("last_lng", { precision: 10, scale: 7, mode: "number" }),
    lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
    // Null until the user enters the code emailed to them; unverified
    // accounts are treated as logged out everywhere except /verify-email.
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// One active verification code per user (the latest send replaces the previous one).
export const emailVerifications = pgTable("email_verifications", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shipments = pgTable(
  "shipments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    trackingNumber: varchar("tracking_number", { length: 20 }),
    // Null for a guest-checkout shipment until the guest claims it with an account.
    customerId: bigint("customer_id", { mode: "number" }).references(() => users.id),
    guestToken: varchar("guest_token", { length: 64 }),
    driverId: bigint("driver_id", { mode: "number" }).references(() => users.id),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    serviceType: varchar("service_type", { length: 30 }).notNull().default(""),
    pricingMethod: varchar("pricing_method", { length: 20 }).notNull(),
    fulfillment: varchar("fulfillment", { length: 20 }).notNull().default("dropoff"),

    senderName: varchar("sender_name", { length: 191 }).notNull(),
    senderPhone: varchar("sender_phone", { length: 50 }).notNull(),
    senderEmail: varchar("sender_email", { length: 191 }),
    receiverName: varchar("receiver_name", { length: 191 }).notNull(),
    receiverPhone: varchar("receiver_phone", { length: 50 }).notNull(),

    pickupAddress: varchar("pickup_address", { length: 255 }).notNull(),
    pickupCity: varchar("pickup_city", { length: 100 }).notNull(),
    pickupPostalCode: varchar("pickup_postal_code", { length: 20 }),
    pickupCountry: varchar("pickup_country", { length: 100 }).notNull(),
    deliveryAddress: varchar("delivery_address", { length: 255 }).notNull(),
    deliveryCity: varchar("delivery_city", { length: 100 }).notNull(),
    deliveryPostalCode: varchar("delivery_postal_code", { length: 20 }),
    deliveryCountry: varchar("delivery_country", { length: 100 }).notNull(),

    // Aggregates across shipment_packages, kept in sync on save (pricing uses total weight).
    packageWeight: numeric("package_weight", { precision: 10, scale: 2, mode: "number" }).notNull(),
    packagePieces: integer("package_pieces").notNull().default(1),
    isDocument: boolean("is_document").notNull().default(false),

    shipmentPurpose: varchar("shipment_purpose", { length: 50 }),
    shipmentReference: varchar("shipment_reference", { length: 191 }),
    shippingDate: date("shipping_date"),
    notes: text("notes"),

    distanceKm: numeric("distance_km", { precision: 10, scale: 2, mode: "number" }),
    addons: jsonb("addons").$type<string[]>().notNull().default([]),
    addonsTotalNgn: numeric("addons_total_ngn", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    deliveryEstimate: varchar("delivery_estimate", { length: 50 }),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    chargeCurrency: varchar("charge_currency", { length: 10 }),
    chargeAmount: numeric("charge_amount", { precision: 12, scale: 2, mode: "number" }),

    paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("unpaid"),
    paymentGateway: varchar("payment_gateway", { length: 30 }),
    paymentReference: varchar("payment_reference", { length: 191 }),

    customsItemDescription: varchar("customs_item_description", { length: 255 }),
    customsCommodityCode: varchar("customs_commodity_code", { length: 50 }),
    customsCountryOfOrigin: varchar("customs_country_of_origin", { length: 100 }),
    customsDeclaredValueNgn: numeric("customs_declared_value_ngn", { precision: 12, scale: 2, mode: "number" }),
    customsRemarks: text("customs_remarks"),
    customsElectronic: boolean("customs_electronic").notNull().default(true),

    // Vercel Blob URLs — files never go in the database.
    customsSignatureUrl: text("customs_signature_url"),
    customsLogoUrl: text("customs_logo_url"),
    pickupPhotoUrl: text("pickup_photo_url"),
    deliveryPhotoUrl: text("delivery_photo_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shipments_tracking_idx").on(t.trackingNumber),
    index("shipments_customer_idx").on(t.customerId),
    index("shipments_driver_idx").on(t.driverId),
    index("shipments_status_idx").on(t.status),
  ],
);

export const shipmentPackages = pgTable(
  "shipment_packages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    shipmentId: bigint("shipment_id", { mode: "number" })
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 191 }),
    weight: numeric("weight", { precision: 10, scale: 2, mode: "number" }).notNull(),
    pieces: integer("pieces").notNull().default(1),
    length: numeric("length", { precision: 10, scale: 2, mode: "number" }),
    width: numeric("width", { precision: 10, scale: 2, mode: "number" }),
    height: numeric("height", { precision: 10, scale: 2, mode: "number" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("packages_shipment_idx").on(t.shipmentId)],
);

export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    shipmentId: bigint("shipment_id", { mode: "number" })
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull(),
    note: text("note"),
    lat: numeric("lat", { precision: 10, scale: 7, mode: "number" }),
    lng: numeric("lng", { precision: 10, scale: 7, mode: "number" }),
    createdBy: bigint("created_by", { mode: "number" }).references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_shipment_idx").on(t.shipmentId)],
);

export const contactMessages = pgTable("contact_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  subject: varchar("subject", { length: 191 }),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cities = pgTable(
  "cities",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    city: varchar("city", { length: 191 }).notNull(),
    country: varchar("country", { length: 100 }).notNull(),
    adminRegion: varchar("admin_region", { length: 191 }),
    postalCode: varchar("postal_code", { length: 20 }),
    lat: numeric("lat", { precision: 10, scale: 7, mode: "number" }),
    lng: numeric("lng", { precision: 10, scale: 7, mode: "number" }),
  },
  // Prefix search (city LIKE 'term%') filtered by country — the only query the autocomplete runs.
  (t) => [index("cities_country_city_idx").on(t.country, t.city.op("text_pattern_ops"))],
);

// Admin-editable pricing rates (one row, key = "pricing"). Payment gateway
// secret keys are NOT stored here — they live in Vercel environment variables.
export const settings = pgTable("settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
