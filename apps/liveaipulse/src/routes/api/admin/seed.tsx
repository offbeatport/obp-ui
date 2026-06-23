import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/admin/seed") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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
        const { categories } = await import("../../../db/schema");

        // Wipe all categories (cascades to queries, rankings)
        await db.delete(categories);

        // Re-seed
        const { seedIfEmpty } = await import("../../../lib/seed");
        await seedIfEmpty();

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
