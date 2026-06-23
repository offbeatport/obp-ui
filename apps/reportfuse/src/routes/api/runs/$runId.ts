import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/runs/$runId") as any)({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { runId: string } }) => {
        const { auth } = await import("../../../lib/auth");
        const { db } = await import("../../../db/client");
        const { runs } = await import("../../../db/schema");
        const { and, eq } = await import("drizzle-orm");

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const run = await db
          .select()
          .from(runs)
          .where(and(eq(runs.id, params.runId), eq(runs.userId, session.user.id)))
          .get();

        if (!run) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ run }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
