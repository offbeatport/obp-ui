import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/admin/runs/$runId/cancel") as any)({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { runId: string } }) => {
        const { checkAdminSession } = await import("../../../lib/admin");
        const session = await checkAdminSession(request);
        if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        const { db } = await import("../../../db/client");
        const { runs } = await import("../../../db/schema");
        const { eq, and, inArray } = await import("drizzle-orm");

        const [run] = await db.select().from(runs).where(eq(runs.id, params.runId));
        if (!run) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        if (run.status !== "running") {
          return new Response(JSON.stringify({ error: "Run is not running" }), { status: 400 });
        }

        await db.update(runs).set({ status: "cancelled" }).where(eq(runs.id, params.runId));

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
  component: () => null,
} as any);
