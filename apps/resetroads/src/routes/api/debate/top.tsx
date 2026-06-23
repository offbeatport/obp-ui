import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/debate/top") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { db } = await import("../../../db/client");
        const { analyses } = await import("../../../db/schema");
        const { runTopDebate } = await import("../../../lib/debate");
        const { eq } = await import("drizzle-orm");

        const { id } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ error: "Missing id" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
        if (!analysis || !analysis.profile) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const debate = await runTopDebate(
          analysis.profile,
          analysis.decisionType,
          analysis.decisionDetail
        );

        await db.update(analyses).set({ topDebate: debate }).where(eq(analyses.id, id));

        return new Response(
          JSON.stringify({
            round1: debate.rounds[0],
            meta: {
              question: debate.question,
              context: debate.context,
              modelsUsed: debate.modelsUsed,
              runTime: debate.runTime,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
