import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/webhooks/polar") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.POLAR_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured.", { status: 500 });
        }
        const sig = request.headers.get("webhook-signature") ?? "";
        if (!sig) {
          return new Response("Missing signature.", { status: 401 });
        }
        // TODO: verify HMAC-SHA256 sig when tier enforcement is wired.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
