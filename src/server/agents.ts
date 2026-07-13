import { createServerFn } from "@tanstack/react-start";
import { resolveAgentConfig } from "~/config/agent";
import { AI_TASKS } from "~/config/ai-catalog";
import { resolveTaskModel, taskProvider } from "~/config/ai-tasks";
import { getConfig, secretLast4, setConfig, setSecret } from "~/config/store";
import { deploymentMode } from "~/lib/deployment";
import { detectAgents } from "./detect";

const PROVIDER_IDS = [
    "openrouter",
    "anthropic",
    "openai",
    "perplexity",
    "xai",
    "google",
    "zai",
    "custom",
];

// Boot state — drives the onboarding gate + which tabs show.
export const getBootState = createServerFn({ method: "GET" }).handler(async () => {
    return {
        deployment: deploymentMode(),
        onboarded: getConfig("onboarding.completed_at") != null,
    };
});

// Discover installed coding-agent CLIs (self-host only). Hosted short-circuits.
export const discoverAgents = createServerFn({ method: "GET" }).handler(async () => {
    if (deploymentMode() === "hosted") {
        return {
            deployment: "hosted" as const,
            agents: [],
            managedAvailable: true,
            recommended: "openrouter",
        };
    }
    const agents = await detectAgents();
    const claude = agents.find((a) => a.id === "claude");
    const recommended =
        claude?.installed && claude.authState === "authed" ? "claude" : "openrouter";
    return { deployment: "self-host" as const, agents, managedAvailable: false, recommended };
});

// Current effective config (never returns raw secrets — only last4).
export const getAgentConfig = createServerFn({ method: "GET" }).handler(async () => {
    const r = resolveAgentConfig();
    return {
        harness: getConfig<string>("agent.harness") ?? "noop",
        credMode: r.credMode,
        brainProvider: r.brainProvider,
        brainModel: r.brainModel ?? "",
        anthropicKeyLast4: secretLast4("agent.anthropic_api_key") ?? null,
        openrouterKeyLast4: secretLast4("agent.openrouter_api_key") ?? null,
        guardrailPreset: getConfig<string>("guardrails.preset") ?? "lean",
        budgetCapUsd: getConfig<number>("guardrails.budget_cap_usd") ?? null,
        autopilot: getConfig<string>("guardrails.autopilot") ?? "off",
        accountName: getConfig<string>("account.name") ?? "Vlad",
    };
});

// One upsert per field. secret=true routes to the server-only secret store.
export const saveConfig = createServerFn({ method: "POST" })
    .validator((d: { key: string; value: unknown; secret?: boolean }) => d)
    .handler(async ({ data }) => {
        if (data.secret) setSecret(data.key, String(data.value ?? ""));
        else setConfig(data.key, data.value);
        return { ok: true };
    });

export const completeOnboarding = createServerFn({ method: "POST" }).handler(async () => {
    setConfig("onboarding.completed_at", Date.now());
    return { ok: true };
});

export const resetOnboarding = createServerFn({ method: "POST" }).handler(async () => {
    setConfig("onboarding.completed_at", null);
    return { ok: true };
});

// Live-check a brain (thinking) provider key by hitting its models endpoint.
export const testBrainConnection = createServerFn({ method: "POST" })
    .validator((d: { provider: string; key: string; baseUrl?: string }) => d)
    .handler(async ({ data }) => {
        const key = data.key.trim();
        if (!key) return { ok: false, detail: "No key provided" };
        const ctrl = AbortSignal.timeout(8000);
        try {
            if (data.provider === "anthropic") {
                const res = await fetch("https://api.anthropic.com/v1/models", {
                    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
                    signal: ctrl,
                });
                return res.ok
                    ? { ok: true, detail: "Connected" }
                    : { ok: false, detail: `HTTP ${res.status}` };
            }
            const base =
                data.baseUrl ||
                (data.provider === "openai"
                    ? "https://api.openai.com/v1"
                    : "https://openrouter.ai/api/v1");
            const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
                headers: { Authorization: `Bearer ${key}` },
                signal: ctrl,
            });
            return res.ok
                ? { ok: true, detail: "Connected" }
                : { ok: false, detail: `HTTP ${res.status}` };
        } catch (e) {
            return { ok: false, detail: e instanceof Error ? e.message : "Request failed" };
        }
    });

// Per-task routing state for the Advanced matrix: each task's provider+model (resolved) + the
// builder (build/hands) choice + per-provider key last4. Writes go through saveConfig.
export const getTaskRouting = createServerFn({ method: "GET" }).handler(async () => {
    const tasks: Record<string, { provider: string; model: string; via?: string }> = {};
    for (const t of AI_TASKS) {
        const r = resolveTaskModel(t);
        tasks[t] =
            r.kind === "model"
                ? { provider: r.provider, model: r.model, via: r.via }
                : {
                      provider: taskProvider("build"),
                      model: getConfig<string>("ai.task.build.model") ?? "",
                  };
    }
    const keys: Record<string, string | null> = {};
    for (const p of PROVIDER_IDS) {
        keys[p] =
            secretLast4(`ai.key.${p}`) ??
            (p === "openrouter"
                ? (secretLast4("agent.openrouter_api_key") ?? null)
                : p === "anthropic"
                  ? (secretLast4("agent.anthropic_api_key") ?? null)
                  : null);
    }
    return {
        builder: taskProvider("build"),
        simple: getConfig<string>("ai.simple") ?? null,
        tasks,
        keys,
    };
});
