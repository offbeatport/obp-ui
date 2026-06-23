import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/settings") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../lib/auth");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { db } = await import("../../db/client");
        const { merchants, merchantSettings } = await import("../../db/schema");
        const { eq } = await import("drizzle-orm");
        const { randomUUID } = await import("node:crypto");

        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.userId, session.user.id),
        });
        if (!merchant) return Response.json({ error: "No store connected" }, { status: 404 });

        const body = await request.json() as {
          riskThreshold?: number;
          minOrderValue?: number;
          channelSms?: boolean;
          channelEmail?: boolean;
          tone?: string;
          excludeGifts?: boolean;
          excludeSale?: boolean;
        };

        const existing = await db.query.merchantSettings.findFirst({
          where: eq(merchantSettings.merchantId, merchant.id),
        });

        if (existing) {
          await db.update(merchantSettings).set({
            riskThreshold: body.riskThreshold ?? existing.riskThreshold,
            minOrderValue: body.minOrderValue ?? existing.minOrderValue,
            channelSms: body.channelSms ?? existing.channelSms,
            channelEmail: body.channelEmail ?? existing.channelEmail,
            tone: (body.tone as any) ?? existing.tone,
            excludeGifts: body.excludeGifts ?? existing.excludeGifts,
            excludeSale: body.excludeSale ?? existing.excludeSale,
          }).where(eq(merchantSettings.merchantId, merchant.id));
        } else {
          await db.insert(merchantSettings).values({
            id: randomUUID(),
            merchantId: merchant.id,
            riskThreshold: body.riskThreshold ?? 70,
            minOrderValue: body.minOrderValue ?? 40,
            channelSms: body.channelSms ?? true,
            channelEmail: body.channelEmail ?? false,
            tone: (body.tone as any) ?? "helpful",
            excludeGifts: body.excludeGifts ?? false,
            excludeSale: body.excludeSale ?? true,
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
