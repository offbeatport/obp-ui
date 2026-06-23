import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/shopify/callback") as any)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { verifyHmac, exchangeCodeForToken } = await import("../../../lib/shopify-oauth");
        const { getShopInfo, registerWebhook } = await import("../../../lib/shopify-api");
        const { db } = await import("../../../db/client");
        const { merchants, merchantSettings } = await import("../../../db/schema");
        const { randomUUID } = await import("node:crypto");
        const { eq } = await import("drizzle-orm");
        const { env } = await import("../../../lib/env");
        const { auth } = await import("../../../lib/auth");

        const url = new URL(request.url);
        const query = url.searchParams;

        // Verify HMAC
        if (!verifyHmac(query)) {
          return Response.json({ error: "Invalid HMAC" }, { status: 401 });
        }

        const shop = query.get("shop") ?? "";
        const code = query.get("code") ?? "";
        const state = query.get("state") ?? "";

        // Verify state matches cookie
        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookies = Object.fromEntries(
          cookieHeader.split(";").map((c) => c.trim().split("=").map(decodeURIComponent)),
        );
        if (state && cookies.ps_oauth_state !== state) {
          return Response.json({ error: "State mismatch" }, { status: 401 });
        }

        // Exchange code for access token
        const accessToken = await exchangeCodeForToken(shop, code);

        // Fetch shop info
        const shopInfo = await getShopInfo(accessToken, shop) as Record<string, any>;

        // Get current session (merchant must be logged in to link store)
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user?.id ?? null;

        // Upsert merchant
        const existingMerchant = await db.query.merchants.findFirst({
          where: eq(merchants.shopDomain, shop),
        });

        let merchantId: string;
        if (existingMerchant) {
          merchantId = existingMerchant.id;
          await db.update(merchants).set({
            accessToken,
            shopName: shopInfo.name,
            email: shopInfo.email,
            currency: shopInfo.currency,
            timezone: shopInfo.iana_timezone,
            userId: userId ?? existingMerchant.userId,
          }).where(eq(merchants.id, merchantId));
        } else {
          merchantId = randomUUID();
          await db.insert(merchants).values({
            id: merchantId,
            userId,
            shopDomain: shop,
            accessToken,
            shopName: shopInfo.name,
            email: shopInfo.email,
            currency: shopInfo.currency,
            timezone: shopInfo.iana_timezone,
            agentEnabled: false,
            installedAt: new Date(),
          });
          // Create default settings
          await db.insert(merchantSettings).values({
            id: randomUUID(),
            merchantId,
            riskThreshold: 70,
            minOrderValue: 40,
            channelSms: true,
            channelEmail: false,
            tone: "helpful",
            excludeGifts: false,
            excludeSale: true,
          });
        }

        // Register webhooks
        const webhookBase = `${env.SHOPIFY_APP_URL}/api/webhooks/shopify`;
        await Promise.allSettled([
          registerWebhook(accessToken, shop, "orders/create", `${webhookBase}/orders`),
          registerWebhook(accessToken, shop, "app/uninstalled", `${webhookBase}/uninstall`),
        ]);

        // Store merchant ID in cookie for the session
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/app",
            "Set-Cookie": [
              `ps_oauth_state=; Path=/; HttpOnly; Max-Age=0`,
              `ps_merchant_id=${merchantId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
            ].join(", "),
          },
        });
      },
    },
  },
});
