import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/agent-toggle") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../lib/auth");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { db } = await import("../../db/client");
        const { merchants } = await import("../../db/schema");
        const { eq } = await import("drizzle-orm");
        const body = await request.json() as { enabled: boolean; merchantId: string };

        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.id, body.merchantId),
        });
        if (!merchant || merchant.userId !== session.user.id) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        await db.update(merchants)
          .set({ agentEnabled: body.enabled })
          .where(eq(merchants.id, body.merchantId));

        return Response.json({ ok: true, enabled: body.enabled });
      },
    },
  },
});
