import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/webhooks/shopify/orders") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const shopifyHmac = request.headers.get("x-shopify-hmac-sha256") ?? "";
        const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";

        const rawBody = await request.text();

        // Verify HMAC
        const { verifyWebhookHmac } = await import("../../../../lib/shopify-oauth");
        if (!verifyWebhookHmac(rawBody, shopifyHmac)) {
          console.error("Invalid webhook HMAC from", shopDomain);
          return new Response("Unauthorized", { status: 401 });
        }

        // Always return 200 immediately - Shopify retries on failure
        // Process async in background
        (async () => {
          try {
            const { db } = await import("../../../../db/client");
            const { merchants } = await import("../../../../db/schema");
            const { eq } = await import("drizzle-orm");
            const { processNewOrder } = await import("../../../../lib/dispatcher");

            const merchant = await db.query.merchants.findFirst({
              where: eq(merchants.shopDomain, shopDomain),
            });

            if (!merchant) {
              console.warn(`No merchant found for domain: ${shopDomain}`);
              return;
            }

            const payload = JSON.parse(rawBody);
            await processNewOrder(merchant.id, payload);
          } catch (err) {
            console.error("Webhook processing error:", err);
          }
        })();

        return new Response("OK", { status: 200 });
      },
    },
  },
});
