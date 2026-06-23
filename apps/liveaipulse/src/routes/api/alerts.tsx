import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/alerts") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json();
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : null;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: "Invalid email" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { db } = await import("../../db/client");
        const { emailAlerts } = await import("../../db/schema");
        const { and, eq } = await import("drizzle-orm");

        // Deduplicate
        const existing = await db
          .select()
          .from(emailAlerts)
          .where(
            domain
              ? and(eq(emailAlerts.email, email), eq(emailAlerts.domain, domain))
              : eq(emailAlerts.email, email),
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(emailAlerts).values({
            id: crypto.randomUUID(),
            email,
            domain: domain || null,
          });

          // Sync to Loops — fire-and-forget, don't block the response
          const mailingListId = process.env.LOOPS_MAILING_LIST_ID;
          if (process.env.LOOPS_API_KEY) {
            const { upsertContact } = await import("@offbeatport/ops/loops");
            upsertContact(email, {
              source: "liveaipulse",
              ...(domain ? { trackedDomain: domain } : {}),
              ...(mailingListId ? { mailingLists: { [mailingListId]: true } } : {}),
            }).catch((err) => console.error("[loops] upsertContact failed:", err));
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
