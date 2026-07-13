import { getConfig, getSecret } from "./store.js";

// The v1 harnesses the executor can actually DRIVE. Others may be detected (shown ✓/version)
// but are not selectable as the builder yet ("driver coming").
export const DRIVABLE_HARNESSES = ["noop", "claude"] as const;
export type HarnessKind = (typeof DRIVABLE_HARNESSES)[number];

export type AgentConfig = {
    harnessKind: HarnessKind;
    harnessBin?: string;
    credMode: "subscription" | "apikey";
    brainProvider: string; // openrouter | openai | anthropic | zai | custom
    brainModel?: string;
    brainBaseUrl?: string;
};

function isDrivable(x: string | undefined): x is HarnessKind {
    return !!x && (DRIVABLE_HARNESSES as readonly string[]).includes(x);
}

// Resolve the effective agent config. Precedence: env > DB (app_config/secret) > default.
// Read fresh each call so a Settings/onboarding save applies to the next run (no restart).
export function resolveAgentConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
    const candidate = env.CSLOP_HARNESS ?? getConfig<string>("agent.harness") ?? "noop";
    const harnessKind: HarnessKind = isDrivable(candidate) ? candidate : "noop";

    const hasKey =
        !!env.ANTHROPIC_API_KEY ||
        !!env.OPENROUTER_API_KEY ||
        !!getSecret("agent.anthropic_api_key") ||
        !!getSecret("agent.openrouter_api_key");
    const credMode: "subscription" | "apikey" = hasKey
        ? "apikey"
        : (getConfig<"subscription" | "apikey">("agent.cred_mode") ?? "subscription");

    return {
        harnessKind,
        harnessBin: getConfig<string>("agent.harness_bin") ?? env.CSLOP_HARNESS_BIN,
        credMode,
        brainProvider: getConfig<string>("agent.brain_provider") ?? "openrouter",
        brainModel: getConfig<string>("agent.brain_model"),
        brainBaseUrl: getConfig<string>("agent.brain_base_url"),
    };
}
