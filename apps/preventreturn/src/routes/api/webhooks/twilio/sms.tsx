import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/webhooks/twilio/sms") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Twilio sends form-encoded POST
        const body = new URLSearchParams(await request.text());
        const fromNumber = body.get("From") ?? "";
        const messageBody = body.get("Body")?.trim() ?? "";

        if (!fromNumber || !messageBody) {
          return new Response("<Response/>", {
            headers: { "Content-Type": "text/xml" },
          });
        }

        (async () => {
          try {
            const { db } = await import("../../../../db/client");
            const { interventions, messages, orders, merchants, merchantSettings } = await import("../../../../db/schema");
            const { eq, desc } = await import("drizzle-orm");
            const { generateContinuationMessage } = await import("../../../../lib/message-generator");
            const { sendSMS } = await import("../../../../lib/sms");

            // Find the most recent active intervention for this phone number
            const intervention = await db.query.interventions.findFirst({
              where: eq(interventions.recipientAddress, fromNumber),
              orderBy: [desc(interventions.sentAt)],
            });

            if (!intervention || intervention.outcome !== "awaiting") return;

            // Load conversation history
            const conversationMessages = await db.query.messages.findMany({
              where: eq(messages.interventionId, intervention.id),
              orderBy: [messages.sentAt],
            });

            const history = conversationMessages.map((m) => ({
              from: m.from as "agent" | "buyer",
              body: m.body,
            }));

            // Append buyer's new message
            await db.insert(messages).values({
              id: crypto.randomUUID(),
              interventionId: intervention.id,
              from: "buyer",
              body: messageBody,
              sentAt: new Date(),
            });

            history.push({ from: "buyer", body: messageBody });

            // Load order + merchant for context
            const order = await db.query.orders.findFirst({
              where: eq(orders.id, intervention.orderId),
            });
            const merchant = await db.query.merchants.findFirst({
              where: eq(merchants.id, intervention.merchantId),
            });
            const settings = await db.query.merchantSettings.findFirst({
              where: eq(merchantSettings.merchantId, intervention.merchantId),
            });

            // Detect buyer intent
            const lower = messageBody.toLowerCase();
            type OutcomeType = "awaiting" | "kept" | "size_swapped" | "cancelled" | "no_response";
            let outcome: OutcomeType = "awaiting";
            if (/\bcancel\b|\brefund\b|\bstop\b|\bdon't (want|need)\b/i.test(lower)) {
              outcome = "cancelled";
            } else if (/\bkeep\b|\bright size\b|\bperfect\b|\byes\b|\bconfirm\b|\bship it\b/i.test(lower)) {
              outcome = "kept";
            } else if (/\bswap\b|\bchange\b|\bswitch\b|\bsize \d+\b|\bsmall\b|\bmedium\b|\blarge\b|\bxl\b/i.test(lower)) {
              outcome = "size_swapped";
            }

            // Generate continuation reply
            const reply = await generateContinuationMessage({
              productName: order?.productName ?? "your order",
              buyerFirstName: order?.buyerName?.split(" ")[0] ?? "there",
              tone: (settings?.tone ?? "helpful") as "helpful" | "concise" | "premium",
              channel: "sms",
              conversationHistory: history,
            });

            // Send reply
            const sid = await sendSMS(fromNumber, reply);

            // Save agent reply
            await db.insert(messages).values({
              id: crypto.randomUUID(),
              interventionId: intervention.id,
              from: "agent",
              body: reply,
              externalId: sid,
              sentAt: new Date(),
            });

            // Update outcome if resolved
            if (outcome !== "awaiting") {
              await db.update(interventions).set({
                outcome,
                resolvedAt: new Date(),
              }).where(eq(interventions.id, intervention.id));

              await db.update(orders).set({ status: "resolved" })
                .where(eq(orders.id, intervention.orderId));
            }
          } catch (err) {
            console.error("SMS reply handler error:", err);
          }
        })();

        // Return empty TwiML response immediately
        return new Response("<Response/>", {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
