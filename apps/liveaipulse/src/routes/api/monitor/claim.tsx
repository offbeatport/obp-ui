import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/monitor/claim") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const email =
            typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          const domain =
            typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";

          if (!email || !domain) {
            return new Response(JSON.stringify({ error: "email and domain are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { db } = await import("../../../db/client");
          const { brandMonitors } = await import("../../../db/schema");
          const { sendEmail } = await import("@offbeatport/ops/email");

          const { randomUUID } = await import("crypto");

          await db
            .insert(brandMonitors)
            .values({
              id: randomUUID(),
              email,
              domain,
            })
            .onConflictDoNothing();

          await sendEmail({
            from: "LiveAIPulse <noreply@liveaipulse.com>",
            to: email,
            subject: `You're now tracking ${domain} on LiveAIPulse`,
            html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.6;">
  <p>Hi,</p>
  <p>You'll receive weekly ranking updates for <strong>${domain}</strong>. We'll let you know when its AI visibility changes.</p>
  <p>To get competitor alerts and detailed position history, reply to this email to learn about Brand Monitor Pro.</p>
  <p style="margin-top:2rem;color:#666;font-size:0.875rem;">- The LiveAIPulse team</p>
</div>
            `.trim(),
          });

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[monitor/claim]", err);
          return new Response(
            JSON.stringify({ error: err?.message ?? "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
