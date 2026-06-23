import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";

let _provider: OpenRouterProvider | null = null;

/**
 * Lazy OpenRouter provider. Reads `OPENROUTER_API_KEY` from
 * `.env.shared`. Use the returned function to mint model handles:
 *
 *     const ai = getOpenRouter();
 *     const result = await streamText({ model: ai(DEFAULT_MODEL), prompt });
 */
export function getOpenRouter(): OpenRouterProvider {
  if (!_provider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to the monorepo .env.shared.",
      );
    }
    _provider = createOpenRouter({ apiKey });
  }
  return _provider;
}

/**
 * Cheap-and-fast default. Override per-call when an app needs more
 * horsepower (claude-3.5-sonnet, gpt-4o, etc.).
 */
export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

/**
 * Convenience: returns a configured model handle for the default
 * model. Equivalent to `getOpenRouter()(DEFAULT_MODEL)`.
 */
export function defaultModel() {
  return getOpenRouter()(DEFAULT_MODEL);
}

/**
 * Re-export the bits of `ai` apps reach for so a tool-first app can
 * `import { streamText, defaultModel } from "@offbeatport/microsaas-core/ai"`
 * and not also depend on `ai` directly.
 */
export {
  streamText,
  generateText,
  generateObject,
  streamObject,
  type CoreMessage,
} from "ai";

export { createOpenRouter, type OpenRouterProvider };
