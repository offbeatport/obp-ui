import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/webhooks/polar") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // TODO: verify Polar webhook signature via POLAR_WEBHOOK_SECRET
        // and set user tier to "pro" on subscription.created / .active events
        const body = await request.text();
        console.log("[polar webhook]", body.slice(0, 200));
        return new Response("ok", { status: 200 });
      },
    },
  },
});
