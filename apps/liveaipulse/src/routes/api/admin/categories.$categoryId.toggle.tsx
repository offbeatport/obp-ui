import { createFileRoute } from "@tanstack/react-router";

export const Route = (
  createFileRoute("/api/admin/categories/$categoryId/toggle") as any
)({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { categoryId: string };
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
        const { queries } = await import("../../../db/schema");
        const { eq } = await import("drizzle-orm");

        // Check current state - if all active, deactivate all; otherwise activate all
        const allQueries = await db
          .select()
          .from(queries)
          .where(eq(queries.categoryId, params.categoryId));

        const allActive = allQueries.every((q) => q.active);
        const newState = !allActive;

        await db
          .update(queries)
          .set({ active: newState })
          .where(eq(queries.categoryId, params.categoryId));

        return new Response(JSON.stringify({ active: newState }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
