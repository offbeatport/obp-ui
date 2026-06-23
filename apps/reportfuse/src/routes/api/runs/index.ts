import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/runs/") as any)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        const { db } = await import("../../../db/client");
        const { runs } = await import("../../../db/schema");
        const { eq, desc } = await import("drizzle-orm");

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userRuns = await db
          .select()
          .from(runs)
          .where(eq(runs.userId, session.user.id))
          .orderBy(desc(runs.createdAt))
          .limit(50);

        return new Response(JSON.stringify({ runs: userRuns }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
