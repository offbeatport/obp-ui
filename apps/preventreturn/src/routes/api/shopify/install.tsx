import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/shopify/install") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const { buildInstallUrl, normalizeShopDomain } = await import("../../../lib/shopify-oauth");
          const { randomUUID } = await import("node:crypto");

          let shop: string;
          const ct = request.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) {
            const body = await request.json() as { shop?: string };
            shop = body.shop ?? "";
          } else {
            const body = new URLSearchParams(await request.text());
            shop = body.get("shop") ?? "";
          }

          if (!shop) {
            return Response.json({ error: "Shop URL is required" }, { status: 400 });
          }

          const normalizedShop = normalizeShopDomain(
            shop.includes(".") ? shop : `${shop}.myshopify.com`,
          );
          const state = randomUUID();
          const installUrl = buildInstallUrl(normalizedShop, state);

          return new Response(JSON.stringify({ redirectUrl: installUrl }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": `ps_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
            },
          });
        } catch (err: any) {
          console.error("[shopify/install error]", err);
          return Response.json(
            { error: err?.message ?? "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
