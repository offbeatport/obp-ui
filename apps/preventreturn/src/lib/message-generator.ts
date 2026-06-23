import { env } from "./env";
import type { RiskSignal } from "./risk";

type Tone = "helpful" | "concise" | "premium";
type Channel = "sms" | "email";

const TONE_GUIDANCE: Record<Tone, string> = {
  helpful: "Warm and conversational. Feel free to use one emoji at the end if natural.",
  concise: "Short and direct. Under 140 characters for SMS. No emojis.",
  premium: "Elevated and refined. 'A note from our team'. No emojis. Short sentences.",
};

const CHANNEL_GUIDANCE: Record<Channel, string> = {
  sms: "Must be under 160 characters. One sentence. Clear action.",
  email: "2-3 short sentences. Subject line not needed - just the body.",
};

export async function generateInterventionMessage(opts: {
  productName: string;
  signals: RiskSignal[];
  channel: Channel;
  tone: Tone;
  buyerFirstName: string;
}): Promise<string> {
  const { productName, signals, channel, tone, buyerFirstName } = opts;

  const prompt = `You are PreventReturn, an AI agent helping Shopify merchants reduce returns by reaching out to buyers before their order ships - framed as exceptional customer service.

Write a single intervention message to send to a customer named ${buyerFirstName} who just ordered: ${productName}.

Risk signals detected (DO NOT mention these directly - just address the underlying concern naturally):
${signals.map((s) => `- ${s.label}`).join("\n")}

Rules:
- Frame as white-glove service, NEVER as suspicion or "we think you'll return this"
- One clear question or helpful note + one easy action (swap size / confirm / cancel-free)
- Never mention "return", "return rate", "risk" or imply the buyer might change their mind
- Tone: ${TONE_GUIDANCE[tone]}
- Channel: ${CHANNEL_GUIDANCE[channel]}
- Address the buyer as ${buyerFirstName}

Output ONLY the message text. No quotes, no labels, no explanation.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
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

  if (!res.ok) throw new Error(`OpenRouter error: ${await res.text()}`);

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const message = data.choices?.[0]?.message?.content?.trim();
  if (!message) throw new Error("Empty response from AI");

  return message;
}

export async function generateContinuationMessage(opts: {
  productName: string;
  buyerFirstName: string;
  tone: Tone;
  channel: Channel;
  conversationHistory: Array<{ from: "agent" | "buyer"; body: string }>;
}): Promise<string> {
  const { productName, buyerFirstName, tone, channel, conversationHistory } = opts;

  const history = conversationHistory
    .map((m) => `${m.from === "agent" ? "Agent" : buyerFirstName}: ${m.body}`)
    .join("\n");

  const prompt = `You are PreventReturn, an AI agent helping a Shopify merchant resolve an order query before it ships.

Product: ${productName}
Buyer: ${buyerFirstName}

Conversation so far:
${history}

Continue the conversation as the Agent. Your goal:
- Resolve whatever concern the buyer raised
- If they want to swap size/variant: confirm you'll update the order
- If they want to cancel: be gracious, confirm no charge, offer an alternative product
- If they're happy: confirm order and wish them well
- Tone: ${TONE_GUIDANCE[tone]}
- Channel: ${CHANNEL_GUIDANCE[channel]}
- Never mention returns, risk, or return rates

Output ONLY the next agent message. No labels.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
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

  if (!res.ok) throw new Error(`OpenRouter error: ${await res.text()}`);

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
