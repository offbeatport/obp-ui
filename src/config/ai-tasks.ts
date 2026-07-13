import {
    type AiTask,
    DEFAULT_TASK_ROUTING,
    DIRECT_API_PROVIDERS,
    DRIVABLE_HARNESSES,
    type HarnessKind,
    SIMPLE_PRESETS,
} from "./ai-catalog.js";
import { getConfig, getSecret } from "./store.js";

// SERVER-ONLY resolver (reads app_config/secret). Returns a discriminated union so build
// (a CLI harness) and the model tasks share ONE resolver without a parallel system.
export type ResolvedTask =
    | {
          kind: "harness";
          task: AiTask;
          harnessKind: HarnessKind;
          harnessBin?: string;
          model?: string;
          credMode: "subscription" | "apikey";
      }
    | {
          kind: "model";
          task: AiTask;
          provider: string;
          model: string;
          via: "direct" | "openrouter";
          apiKey?: string;
          baseUrl: string;
      };

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DIRECT_BASE: Record<string, string> = {
    anthropic: "https://api.anthropic.com/v1",
    openai: "https://api.openai.com/v1",
    perplexity: "https://api.perplexity.ai",
    xai: "https://api.x.ai/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    zai: "https://api.z.ai/api/paas/v4",
};

function isDrivable(x: string | undefined): x is HarnessKind {
    return !!x && (DRIVABLE_HARNESSES as readonly string[]).includes(x);
}

/** Raw (unvalidated) provider selection for a task — what the UI shows/edits. */
export function taskProvider(task: AiTask): string {
    return (
        getConfig<string>(`ai.task.${task}.provider`) ??
        (task === "build"
            ? SIMPLE_PRESETS[getConfig<string>("ai.simple") ?? ""]?.build
            : undefined) ??
        DEFAULT_TASK_ROUTING[task].provider
    );
}
export function taskModel(task: AiTask): string {
    return getConfig<string>(`ai.task.${task}.model`) ?? DEFAULT_TASK_ROUTING[task].model;
}

// Per-provider key (shared across tasks). Legacy fallbacks so pre-existing keys survive.
export function keyForProvider(
    provider: string,
    env: NodeJS.ProcessEnv = process.env,
): string | undefined {
    if (provider === "openrouter")
        return (
            env.OPENROUTER_API_KEY ??
            getSecret("ai.key.openrouter") ??
            getSecret("agent.openrouter_api_key")
        );
    if (provider === "anthropic")
        return (
            env.ANTHROPIC_API_KEY ??
            getSecret("ai.key.anthropic") ??
            getSecret("agent.anthropic_api_key")
        );
    return env[`${provider.toUpperCase()}_API_KEY`] ?? getSecret(`ai.key.${provider}`);
}

export function resolveTaskModel(task: AiTask, env: NodeJS.ProcessEnv = process.env): ResolvedTask {
    if (task === "build") {
        const raw = env.CSLOP_HARNESS ?? taskProvider("build");
        const harnessKind: HarnessKind = isDrivable(raw) ? raw : "noop";
        const hasKey =
            !!env.ANTHROPIC_API_KEY ||
            !!getSecret("ai.key.anthropic") ||
            !!getSecret("agent.anthropic_api_key");
        return {
            kind: "harness",
            task,
            harnessKind,
            harnessBin: getConfig<string>("ai.task.build.harness_bin") ?? env.CSLOP_HARNESS_BIN,
            model: getConfig<string>("ai.task.build.model"),
            credMode: hasKey
                ? "apikey"
                : (getConfig<"subscription" | "apikey">("agent.cred_mode") ?? "subscription"),
        };
    }

    const provider = taskProvider(task);
    const model = taskModel(task);

    // Direct if a direct-API provider AND its own key exists; otherwise route via OpenRouter.
    const directKey = DIRECT_API_PROVIDERS.has(provider)
        ? keyForProvider(provider, env)
        : undefined;
    if (provider === "custom") {
        return {
            kind: "model",
            task,
            provider,
            model,
            via: "direct",
            apiKey: keyForProvider("custom", env),
            baseUrl: getConfig<string>("ai.baseurl.custom") ?? OPENROUTER_BASE,
        };
    }
    if (directKey) {
        return {
            kind: "model",
            task,
            provider,
            model,
            via: "direct",
            apiKey: directKey,
            baseUrl: DIRECT_BASE[provider] ?? OPENROUTER_BASE,
        };
    }
    // OpenRouter fallback — a brand model routed through OpenRouter (this is "Perplexity via OpenRouter").
    return {
        kind: "model",
        task,
        provider,
        model,
        via: "openrouter",
        apiKey: keyForProvider("openrouter", env),
        baseUrl: OPENROUTER_BASE,
    };
}
