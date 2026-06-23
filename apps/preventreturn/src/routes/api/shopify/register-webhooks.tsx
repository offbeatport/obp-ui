import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/shopify/register-webhooks") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { auth } = await import("../../../lib/auth");
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const { db } = await import("../../../db/client");
          const { merchants } = await import("../../../db/schema");
          const { eq } = await import("drizzle-orm");
          const { registerWebhook } = await import("../../../lib/shopify-api");
          const { env } = await import("../../../lib/env");

          const merchant = await db.query.merchants.findFirst({
            where: eq(merchants.userId, session.user.id),
          });
          if (!merchant?.accessToken) {
            return Response.json({ error: "No store connected" }, { status: 404 });
          }

          const base = `${env.SHOPIFY_APP_URL}/api/webhooks/shopify`;
          const results = await Promise.allSettled([
            registerWebhook(merchant.accessToken, merchant.shopDomain, "orders/create", `${base}/orders`),
            registerWebhook(merchant.accessToken, merchant.shopDomain, "app/uninstalled", `${base}/uninstall`),
          ]);

          const registered = results.map((r, i) => ({
            topic: i === 0 ? "orders/create" : "app/uninstalled",
            status: r.status,
            error: r.status === "rejected" ? String(r.reason) : undefined,
          }));

          return Response.json({ ok: true, webhooks: registered, appUrl: env.SHOPIFY_APP_URL });
        } catch (err: any) {
          return Response.json({ error: err?.message ?? "Failed" }, { status: 500 });
        }
      },
    },
  },
});
