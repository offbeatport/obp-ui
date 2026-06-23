import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/monitor/checkout") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;
        const POLAR_PRODUCT_ID_BRAND_MONITOR = process.env.POLAR_PRODUCT_ID_BRAND_MONITOR;

        if (!POLAR_ACCESS_TOKEN || !POLAR_PRODUCT_ID_BRAND_MONITOR) {
          return new Response(JSON.stringify({ error: "Billing not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const body = await request.json();
          const email =
            typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          const domain =
            typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";

          if (!email || !domain) {
            return new Response(JSON.stringify({ error: "email and domain are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3003";
          const successUrl = `${baseURL}/monitor/success?domain=${encodeURIComponent(domain)}`;

          const res = await fetch("https://api.polar.sh/v1/checkouts/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              product_id: POLAR_PRODUCT_ID_BRAND_MONITOR,
              success_url: successUrl,
              customer_email: email,
              metadata: { domain, email },
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("[monitor/checkout] Polar error", res.status, text);
            return new Response(JSON.stringify({ error: "Failed to create checkout" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const data = await res.json();

          return new Response(JSON.stringify({ url: data.url }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[monitor/checkout]", err);
          return new Response(
            JSON.stringify({ error: err?.message ?? "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
