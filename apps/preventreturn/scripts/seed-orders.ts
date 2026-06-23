// Run with: pnpm --filter preventreturn exec tsx scripts/seed-orders.ts
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const monorepoRoot = resolve(__dirname, "../..");
const shared = loadEnv("development", monorepoRoot, "");
const local = loadEnv("development", resolve(__dirname, ".."), "");
Object.assign(process.env, shared, local);

const MERCHANT_ID = "3986d92d-ffb3-4e17-8635-397c67a52db1";

const TEST_ORDERS = [
  {
    id: 1001,
    order_number: 4821,
    email: "sarah.k@gmail.com",
    phone: null,
    created_at: new Date(Date.now() - 2 * 60000).toISOString(), // 2 min ago
    total_price: "189.00",
    currency: "USD",
    customer: { id: 1, email: "sarah.k@gmail.com", first_name: "Sarah", last_name: "K", phone: null, orders_count: 1, total_spent: "189.00" },
    billing_address: { zip: "10001", country_code: "US" },
    shipping_address: { zip: "10001", country_code: "US" },
    line_items: [
      { id: 1, title: "Linen Blazer", variant_title: "Small", sku: "BLZ-LIN-S", quantity: 1, price: "189.00", product_id: 1, variant_id: 1 },
      { id: 2, title: "Linen Blazer", variant_title: "Medium", sku: "BLZ-LIN-M", quantity: 1, price: "189.00", product_id: 1, variant_id: 2 },
      { id: 3, title: "Linen Blazer", variant_title: "Large", sku: "BLZ-LIN-L", quantity: 1, price: "189.00", product_id: 1, variant_id: 3 },
    ],
    tags: "",
  },
  {
    id: 1002,
    order_number: 4820,
    email: "james.r@icloud.com",
    phone: "+14155551234",
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
    total_price: "142.00",
    currency: "USD",
    customer: { id: 2, email: "james.r@icloud.com", first_name: "James", last_name: "R", phone: "+14155551234", orders_count: 1, total_spent: "142.00" },
    billing_address: { zip: "94102", country_code: "US" },
    shipping_address: { zip: "94102", country_code: "US" },
    line_items: [
      { id: 4, title: "Air Trainer Pro", variant_title: "US 9", sku: "SHO-ATP-9", quantity: 1, price: "142.00", product_id: 2, variant_id: 4 },
    ],
    tags: "",
  },
  {
    id: 1003,
    order_number: 4819,
    email: "emma.t@me.com",
    phone: null,
    created_at: new Date(Date.now() - 24 * 60000).toISOString(),
    total_price: "220.00",
    currency: "USD",
    customer: { id: 3, email: "emma.t@me.com", first_name: "Emma", last_name: "T", phone: null, orders_count: 8, total_spent: "1240.00" },
    billing_address: { zip: "10001", country_code: "US" },
    shipping_address: { zip: "90210", country_code: "US" }, // different zip = gift
    line_items: [
      { id: 5, title: "Cashmere Crew Neck", variant_title: "Small", sku: "KNT-CSH-S", quantity: 1, price: "220.00", product_id: 3, variant_id: 5 },
    ],
    tags: "",
  },
];

async function main() {
  const { processNewOrder } = await import("../src/lib/dispatcher.js");

  for (const order of TEST_ORDERS) {
    console.log(`\nProcessing order #${order.order_number} - ${order.line_items[0].title}...`);
    try {
      await processNewOrder(MERCHANT_ID, order as any);
      console.log(`✓ Order #${order.order_number} processed`);
    } catch (err: any) {
      console.error(`✗ Order #${order.order_number} failed:`, err.message);
    }
  }

  // Also register webhooks
  console.log("\nRegistering webhooks...");
  const { db } = await import("../src/db/client.js");
  const { merchants } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const { registerWebhook } = await import("../src/lib/shopify-api.js");

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, MERCHANT_ID),
  });

  if (merchant?.accessToken) {
    const base = `${process.env.SHOPIFY_APP_URL}/api/webhooks/shopify`;
    const results = await Promise.allSettled([
      registerWebhook(merchant.accessToken, merchant.shopDomain, "orders/create", `${base}/orders`),
      registerWebhook(merchant.accessToken, merchant.shopDomain, "app/uninstalled", `${base}/uninstall`),
    ]);
    results.forEach((r, i) => {
      const topic = i === 0 ? "orders/create" : "app/uninstalled";
      if (r.status === "fulfilled") console.log(`✓ Webhook registered: ${topic} → ${base}`);
      else console.error(`✗ Webhook failed (${topic}):`, r.reason?.message ?? r.reason);
    });
  }

  console.log("\nDone. Refresh the dashboard.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
