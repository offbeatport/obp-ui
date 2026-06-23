import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/debate/fast") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { db } = await import("../../../db/client");
        const { analyses } = await import("../../../db/schema");
        const { runFastDebate } = await import("../../../lib/debate");
        const { eq } = await import("drizzle-orm");

        const { id } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ error: "Missing id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
        if (!analysis) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!analysis.profile) {
          return new Response(JSON.stringify({ error: "Profile not ready" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const debate = await runFastDebate(
          analysis.profile,
          analysis.decisionType,
          analysis.decisionDetail
        );

        await db.update(analyses).set({ fastDebate: debate }).where(eq(analyses.id, id));

        return new Response(JSON.stringify({ debate }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
