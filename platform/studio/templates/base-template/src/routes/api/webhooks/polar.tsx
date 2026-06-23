import { createAPIFileRoute } from "@tanstack/react-start/api";

/**
 * Polar.sh webhook endpoint.
 * Configure this URL in your Polar dashboard: https://polar.sh/dashboard/webhooks
 *
 * Supported events (extend as needed):
 *   - checkout.created
 *   - checkout.updated
 *   - subscription.created
 *   - subscription.updated
 *   - subscription.canceled
 *   - order.created
 */
export const APIRoute = createAPIFileRoute("/api/webhooks/polar")({
  POST: async ({ request }) => {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("webhook-signature") ?? "";

    const { verifyWebhookSignature } = await import("../../../lib/polar.js");
    const valid = verifyWebhookSignature(rawBody, signature, secret);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    let event: { type: string; data: unknown };
    try {
      event = JSON.parse(rawBody) as { type: string; data: unknown };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // Handle events
    try {
      switch (event.type) {
        case "checkout.created":
        case "checkout.updated":
          // TODO: update checkout state in DB
          break;

        case "subscription.created":
        case "subscription.updated":
          // TODO: provision access / update user tier in DB
          break;

        case "subscription.canceled":
          // TODO: revoke access
          break;

        case "order.created":
          // TODO: one-time purchase fulfillment
          break;

        default:
          // Ignore unknown events
          break;
      }
    } catch (err) {
      console.error("Polar webhook handler error:", err);
      return new Response("Handler error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  },
});
