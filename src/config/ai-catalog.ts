import type { ProviderId as LogoId } from "~/components/provider-logos";

// CLIENT-SAFE catalog (no sqlite import) — the taxonomy of coarse AI tasks, the provider
// catalog, per-task defaults, and the two-button simple presets. The resolver that reads
// config lives in ai-tasks.ts (server-only).

// The harnesses the executor can actually DRIVE today (build/hands task). Others are
// detected/selectable but "driver coming".
export const DRIVABLE_HARNESSES = ["noop", "claude"] as const;
export type HarnessKind = (typeof DRIVABLE_HARNESSES)[number];

// The coarse AI tasks, grounded in the SPEC loop (thought → opportunities → company → actions).
export const AI_TASKS = [
    "build",
    "opportunities",
    "research",
    "plan",
    "write",
    "chat",
    "orchestrate",
] as const;
export type AiTask = (typeof AI_TASKS)[number];

// build is the one HARNESS (hands) task; the rest are MODEL (thinking) tasks.
export const MODEL_TASKS = AI_TASKS.filter((t) => t !== "build") as Exclude<AiTask, "build">[];

export const TASK_META: Record<AiTask, { label: string; purpose: string }> = {
    build: { label: "Build", purpose: "Writes & ships code — the coding agent (hands)." },
    opportunities: {
        label: "Opportunities",
        purpose: "Scores thoughts into ranked bets — cheap, high-volume.",
    },
    research: {
        label: "Research",
        purpose: "Web-grounded demand research → the opportunity report.",
    },
    plan: { label: "Planning", purpose: "Decomposes a promoted bet into the first actions." },
    write: { label: "Messaging", purpose: "Drafts posts, cold outreach, support replies." },
    chat: { label: "Chat", purpose: "The command-bar / assistant. Fast & cheap." },
    orchestrate: {
        label: "Orchestrate",
        purpose: "Re-ranks the queue & keep/kill/pivot verdicts.",
    },
};

// Provider (brand/route). `logo` maps to provider-logos; "custom" has no glyph.
export type ProviderId = LogoId | "custom";

export const PROVIDERS: { id: ProviderId; label: string; models: string[] }[] = [
    {
        id: "openrouter",
        label: "OpenRouter",
        models: ["anthropic/claude-3.7-sonnet", "openai/gpt-4o", "perplexity/sonar"],
    },
    // Direct-API providers use their native model IDs — NO "provider/" prefix (that's an
    // OpenRouter-only routing convention).
    {
        id: "anthropic",
        label: "Anthropic",
        models: ["claude-3.7-sonnet", "claude-3.5-haiku"],
    },
    { id: "openai", label: "OpenAI", models: ["gpt-4o", "o3-mini"] },
    {
        id: "perplexity",
        label: "Perplexity",
        models: ["perplexity/sonar", "perplexity/sonar-reasoning"],
    },
    { id: "xai", label: "xAI (Grok)", models: ["x-ai/grok-2", "x-ai/grok-beta"] },
    {
        id: "google",
        label: "Google (Gemini)",
        models: ["google/gemini-2.0-flash-001", "google/gemini-flash-1.5"],
    },
    { id: "zai", label: "z.ai (GLM)", models: ["z-ai/glm-4.6"] },
    { id: "custom", label: "Custom…", models: [] },
];

export function providerLabel(id: string): string {
    return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

// Per-task system defaults (model tasks route via OpenRouter with a sane model).
export const DEFAULT_TASK_ROUTING: Record<AiTask, { provider: string; model: string }> = {
    build: { provider: "noop", model: "" },
    opportunities: { provider: "openrouter", model: "anthropic/claude-3.5-haiku" },
    research: { provider: "openrouter", model: "perplexity/sonar" },
    plan: { provider: "openrouter", model: "anthropic/claude-3.7-sonnet" },
    write: { provider: "openrouter", model: "anthropic/claude-3.7-sonnet" },
    chat: { provider: "openrouter", model: "anthropic/claude-3.5-haiku" },
    orchestrate: { provider: "openrouter", model: "anthropic/claude-3.5-haiku" },
};

// The two-button simple choice seeds the build (hands) harness. Thinking tasks use the
// defaults above unless overridden per-task.
export const SIMPLE_PRESETS: Record<string, { build: string }> = {
    claude: { build: "claude" },
    codex: { build: "codex" },
};

// Providers with a real HTTP API we can key directly (else route via OpenRouter).
export const DIRECT_API_PROVIDERS = new Set([
    "anthropic",
    "openai",
    "perplexity",
    "xai",
    "google",
    "zai",
]);
