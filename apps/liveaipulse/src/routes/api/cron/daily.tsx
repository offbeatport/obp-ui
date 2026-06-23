import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/cron/daily") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET ?? "dev-cron-secret";
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { startRun } = await import("../../../lib/run-processor");
        return startRun();
      },
    },
  },
});
