// ── Model pricing (USD per 1M tokens) - fallback only ────────────────────────
// Used when OpenRouter's generation API is unavailable or returns no cost.
// Primary source of truth: OpenRouter's /api/v1/generation endpoint.

export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  // Claude Sonnet
  "anthropic/claude-sonnet-4-6": { input: 3.00, output: 15.00 },
  "anthropic/claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "anthropic/claude-3-5-sonnet": { input: 3.00, output: 15.00 },
  // Claude Haiku
  "anthropic/claude-haiku-4-5": { input: 0.80, output: 4.00 },
  "anthropic/claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
  // Claude Opus
  "anthropic/claude-opus-4-7": { input: 15.00, output: 75.00 },
  "anthropic/claude-opus-4": { input: 15.00, output: 75.00 },
  // Gemini
  "google/gemini-3.1-flash-lite-preview": { input: 0.075, output: 0.30 },
  "google/gemini-2.0-flash-lite": { input: 0.075, output: 0.30 },
  "google/gemini-flash-1.5": { input: 0.075, output: 0.30 },
  "google/gemini-pro-1.5": { input: 1.25, output: 5.00 },
  // OpenAI
  "openai/gpt-4o": { input: 2.50, output: 10.00 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.60 },
  "openai/text-embedding-3-small": { input: 0.02, output: 0 },
  "openai/text-embedding-3-large": { input: 0.13, output: 0 },
};

export function calcCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const prices = MODEL_PRICES[model];
  if (!prices) return 0;
  return (promptTokens / 1_000_000) * prices.input + (completionTokens / 1_000_000) * prices.output;
}

// Fetch exact cost from OpenRouter's generation endpoint.
// Returns null if unavailable (API key missing, network error, generation too recent).
async function fetchOpenRouterCost(generationId: string): Promise<number | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !generationId.startsWith("gen-")) return null;
  try {
    // OpenRouter may need a few seconds to record the cost - retry once after a short delay
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { total_cost?: number } };
    const cost = json?.data?.total_cost;
    return typeof cost === "number" && cost >= 0 ? cost : null;
  } catch {
    return null;
  }
}

const MAX_TEXT = 8000; // chars stored per prompt/response

// ── Fire-and-forget tracker ───────────────────────────────────────────────────

export function trackCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  callType: string,
  generationId?: string,
  promptText?: string,
  responseText?: string,
): void {
  (async () => {
    try {
      let costUsd: number | null = generationId
        ? await fetchOpenRouterCost(generationId)
        : null;

      if (costUsd === null) {
        costUsd = calcCostUsd(model, promptTokens, completionTokens);
      }

      if (costUsd === 0 && promptTokens === 0) return;

      const { db } = await import("../db/index.js");
      const { aiCostEntries } = await import("../db/schema.js");
      await db.insert(aiCostEntries).values({
        model, callType,
        promptTokens, completionTokens,
        costUsd,
        promptText: promptText ? promptText.slice(0, MAX_TEXT) : null,
        responseText: responseText ? responseText.slice(0, MAX_TEXT) : null,
        createdAt: new Date(),
      });
    } catch {
      // never crash the caller
    }
  })();
}
