import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/shopify/disconnect") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { db } = await import("../../../db/client");
        const { merchants } = await import("../../../db/schema");
        const { eq } = await import("drizzle-orm");

        await db.update(merchants)
          .set({ accessToken: "", agentEnabled: false })
          .where(eq(merchants.userId, session.user.id));

        return Response.json({ ok: true });
      },
    },
  },
});
