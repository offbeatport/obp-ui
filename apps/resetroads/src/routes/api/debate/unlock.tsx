import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/debate/unlock") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { db } = await import("../../../db/client");
        const { analyses } = await import("../../../db/schema");
        const { eq } = await import("drizzle-orm");

        const { id, email } = await request.json();
        if (!id || !email) {
          return new Response(JSON.stringify({ error: "Missing id or email" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
        if (!analysis || !analysis.topDebate) {
          return new Response(JSON.stringify({ error: "Debate not ready" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        await db.update(analyses).set({ gatedEmail: email }).where(eq(analyses.id, id));

        return new Response(JSON.stringify({ debate: analysis.topDebate }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
