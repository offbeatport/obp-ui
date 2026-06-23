import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/generate-message") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          productName?: string;
          signals?: string[];
          channel?: string;
          buyerName?: string;
        };

        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { productName, signals = [], channel = "sms", buyerName = "there" } = body;

        if (!productName) {
          return Response.json({ error: "productName required" }, { status: 400 });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "OPENROUTER_API_KEY not set" }, { status: 500 });
        }

        const channelGuidance =
          channel === "sms"
            ? "Keep it under 160 characters. Conversational, warm, not formal."
            : "Write 2-3 short sentences. Friendly and helpful tone.";

        const prompt = `You are PreventReturn, an AI agent that helps Shopify merchants prevent returns by proactively reaching out to customers before their order ships.

Write a single intervention message to send to a customer named ${buyerName} who just ordered: ${productName}.

Risk signals detected on this order:
${signals.map((s) => `- ${s}`).join("\n")}

Rules:
- Frame as white-glove service, NEVER as suspicion
- One specific question or helpful note - not multiple asks
- Offer an easy action (swap size, confirm, cancel-free)
- ${channelGuidance}
- No emojis at the start. One emoji max at the end if it feels natural.
- Do NOT mention "return" or "return rate" or "risk" - ever.

Output the message text only. No quotes, no labels, no explanation.`;

        try {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://preventreturn.com",
              "X-Title": "PreventReturn",
            },
            body: JSON.stringify({
              model: "anthropic/claude-3-5-haiku",
              max_tokens: 200,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (!res.ok) {
            const err = await res.text();
            console.error("OpenRouter error:", err);
            return Response.json({ error: "AI generation failed" }, { status: 502 });
          }

          const data = await res.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const message = data.choices?.[0]?.message?.content?.trim();

          if (!message) {
            return Response.json({ error: "Empty response from AI" }, { status: 502 });
          }

          return Response.json({ message });
        } catch (err) {
          console.error("Generate message error:", err);
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
