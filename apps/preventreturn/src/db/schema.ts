import { idCol, timestamps } from "@offbeatport/db/columns";
import { user } from "@offbeatport/db/schema/auth";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Merchants ──────────────────────────────────────────────────────────────

export const merchants = sqliteTable("merchants", {
  id: idCol(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  shopDomain: text("shop_domain").notNull().unique(),
  accessToken: text("access_token").notNull(),
  shopName: text("shop_name"),
  email: text("email"),
  currency: text("currency").default("USD"),
  timezone: text("timezone").default("America/New_York"),
  agentEnabled: integer("agent_enabled", { mode: "boolean" }).notNull().default(false),
  installedAt: integer("installed_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  ...timestamps,
});

// ─── Merchant settings ──────────────────────────────────────────────────────

export const merchantSettings = sqliteTable("merchant_settings", {
  id: idCol(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }).unique(),
  riskThreshold: integer("risk_threshold").notNull().default(70),
  minOrderValue: real("min_order_value").notNull().default(40),
  channelSms: integer("channel_sms", { mode: "boolean" }).notNull().default(true),
  channelEmail: integer("channel_email", { mode: "boolean" }).notNull().default(false),
  tone: text("tone", { enum: ["helpful", "concise", "premium"] }).notNull().default("helpful"),
  excludeGifts: integer("exclude_gifts", { mode: "boolean" }).notNull().default(false),
  excludeSale: integer("exclude_sale", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = sqliteTable("orders", {
  id: idCol(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  shopifyOrderId: text("shopify_order_id").notNull(),
  shopifyOrderNumber: text("shopify_order_number"),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  buyerPhone: text("buyer_phone"),
  productName: text("product_name"),
  productSku: text("product_sku"),
  productCategory: text("product_category"),
  orderValue: real("order_value").notNull().default(0),
  currency: text("currency").default("USD"),
  riskScore: integer("risk_score").notNull().default(0),
  riskSignals: text("risk_signals", { mode: "json" }).$type<Array<{ label: string; severity: "high" | "medium" | "low"; weight: number }>>().default([]),
  isFirstTimebuyer: integer("is_first_time_buyer", { mode: "boolean" }).default(false),
  status: text("status", { enum: ["watching", "intervening", "resolved", "skipped"] }).notNull().default("watching"),
  shopifyPayload: text("shopify_payload", { mode: "json" }).$type<Record<string, unknown>>(),
  placedAt: integer("placed_at", { mode: "timestamp" }),
  ...timestamps,
});

// ─── Interventions ──────────────────────────────────────────────────────────

export const interventions = sqliteTable("interventions", {
  id: idCol(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["sms", "email"] }).notNull(),
  recipientAddress: text("recipient_address").notNull(),
  outcome: text("outcome", { enum: ["awaiting", "kept", "size_swapped", "cancelled", "no_response"] }).notNull().default("awaiting"),
  returnActuallyHappened: integer("return_actually_happened", { mode: "boolean" }),
  returnCostSaved: real("return_cost_saved"),
  cancellationCostIncurred: real("cancellation_cost_incurred"),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  ...timestamps,
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = sqliteTable("messages", {
  id: idCol(),
  interventionId: text("intervention_id").notNull().references(() => interventions.id, { onDelete: "cascade" }),
  from: text("from", { enum: ["agent", "buyer"] }).notNull(),
  body: text("body").notNull(),
  externalId: text("external_id"),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  ...timestamps,
});

// ─── Migrations SQL ──────────────────────────────────────────────────────────

export const PREVENTSHIP_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  shop_name TEXT,
  email TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'America/New_York',
  agent_enabled INTEGER NOT NULL DEFAULT 0,
  installed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_settings (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
  risk_threshold INTEGER NOT NULL DEFAULT 70,
  min_order_value REAL NOT NULL DEFAULT 40,
  channel_sms INTEGER NOT NULL DEFAULT 1,
  channel_email INTEGER NOT NULL DEFAULT 0,
  tone TEXT NOT NULL DEFAULT 'helpful',
  exclude_gifts INTEGER NOT NULL DEFAULT 0,
  exclude_sale INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  shopify_order_number TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  product_name TEXT,
  product_sku TEXT,
  product_category TEXT,
  order_value REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_signals TEXT DEFAULT '[]',
  is_first_time_buyer INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'watching',
  shopify_payload TEXT,
  placed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'awaiting',
  return_actually_happened INTEGER,
  return_cost_saved REAL,
  cancellation_cost_incurred REAL,
  sent_at INTEGER NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  "from" TEXT NOT NULL,
  body TEXT NOT NULL,
  external_id TEXT,
  sent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
