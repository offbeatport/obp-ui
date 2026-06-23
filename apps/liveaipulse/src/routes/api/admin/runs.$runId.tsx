import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/admin/runs/$runId") as any)({
  server: {
    handlers: {
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { runId: string };
      }) => {
        const { auth } = await import("../../../lib/auth");
        const { isAdminEmail } = await import("../../../lib/admin");

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user || !isAdminEmail(session.user.email)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { db } = await import("../../../db/client");
        const { runs } = await import("../../../db/schema");
        const { eq } = await import("drizzle-orm");

        await db.delete(runs).where(eq(runs.id, params.runId));

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
