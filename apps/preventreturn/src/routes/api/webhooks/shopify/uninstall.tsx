import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/webhooks/shopify/uninstall") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const shopifyHmac = request.headers.get("x-shopify-hmac-sha256") ?? "";
        const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
        const rawBody = await request.text();

        const { verifyWebhookHmac } = await import("../../../../lib/shopify-oauth");
        if (!verifyWebhookHmac(rawBody, shopifyHmac)) {
          return new Response("Unauthorized", { status: 401 });
        }

        (async () => {
          try {
            const { db } = await import("../../../../db/client");
            const { merchants } = await import("../../../../db/schema");
            const { eq } = await import("drizzle-orm");
            await db.update(merchants)
              .set({ agentEnabled: false, accessToken: "" })
              .where(eq(merchants.shopDomain, shopDomain));
          } catch (err) {
            console.error("Uninstall webhook error:", err);
          }
        })();

        return new Response("OK", { status: 200 });
      },
    },
  },
});
