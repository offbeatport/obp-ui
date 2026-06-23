import { createFileRoute } from "@tanstack/react-router";

// DEV ONLY - simulates an incoming Shopify order webhook for testing
export const Route = (createFileRoute("/api/dev/simulate-order") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { db } = await import("../../../db/client");
        const { merchants } = await import("../../../db/schema");
        const { eq } = await import("../../../db/client").then(() => import("drizzle-orm"));
        const { processNewOrder } = await import("../../../lib/dispatcher");

        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.userId, session.user.id),
        });
        if (!merchant) return Response.json({ error: "No store connected" }, { status: 404 });

        const body = await request.json().catch(() => ({})) as Record<string, any>;

        // Build a realistic test order payload
        const testOrder = {
          id: Date.now(),
          order_number: Math.floor(1000 + Math.random() * 9000),
          email: body.email ?? "testbuyer@example.com",
          phone: body.phone ?? null,
          created_at: new Date().toISOString(),
          total_price: String(body.total_price ?? 149),
          currency: "USD",
          customer: {
            id: 1,
            email: body.email ?? "testbuyer@example.com",
            first_name: body.first_name ?? "Sarah",
            last_name: body.last_name ?? "K",
            phone: body.phone ?? null,
            orders_count: body.orders_count ?? 1,
            total_spent: String(body.total_price ?? 149),
          },
          billing_address: { zip: "10001", country_code: "US" },
          shipping_address: { zip: body.gift ? "90210" : "10001", country_code: "US" },
          line_items: body.line_items ?? [
            {
              id: 1,
              title: body.product ?? "Linen Blazer",
              variant_title: body.variant ?? "Medium",
              sku: "BLZ-LIN-M",
              quantity: 1,
              price: String(body.total_price ?? 149),
              product_id: 1,
              variant_id: 1,
            },
            // Bracketing simulation - ordered multiple sizes
            ...(body.bracketing ? [
              { id: 2, title: body.product ?? "Linen Blazer", variant_title: "Small", sku: "BLZ-LIN-S", quantity: 1, price: String(body.total_price ?? 149), product_id: 1, variant_id: 2 },
              { id: 3, title: body.product ?? "Linen Blazer", variant_title: "Large", sku: "BLZ-LIN-L", quantity: 1, price: String(body.total_price ?? 149), product_id: 1, variant_id: 3 },
            ] : []),
          ],
          tags: "",
        };

        try {
          await processNewOrder(merchant.id, testOrder as any);
          return Response.json({ ok: true, orderId: testOrder.id, orderNumber: testOrder.order_number });
        } catch (err: any) {
          return Response.json({ error: err?.message ?? "Processing failed" }, { status: 500 });
        }
      },
    },
  },
});
