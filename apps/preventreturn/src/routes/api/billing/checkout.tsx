import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/billing/checkout") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json() as { plan: "performance" | "pro" };
        const productId = body.plan === "pro"
          ? process.env.POLAR_PRODUCT_ID_PRO
          : process.env.POLAR_PRODUCT_ID_PERFORMANCE;

        if (!productId) {
          return Response.json({ error: "Product not configured" }, { status: 500 });
        }

        const accessToken = process.env.POLAR_ACCESS_TOKEN;
        if (!accessToken) {
          return Response.json({ error: "Billing not configured" }, { status: 500 });
        }

        const appUrl = process.env.SHOPIFY_APP_URL ?? "http://localhost:3005";

        const res = await fetch("https://api.polar.sh/v1/checkouts/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: productId,
            success_url: `${appUrl}/app?billing=success`,
            customer_email: session.user.email,
            metadata: { userId: session.user.id },
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error("Polar checkout error:", err);
          return Response.json({ error: "Failed to create checkout" }, { status: 502 });
        }

        const data = await res.json() as { url: string };
        return Response.json({ url: data.url });
      },
    },
  },
});
