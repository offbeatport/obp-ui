import { DRIVABLE_HARNESSES, type HarnessKind } from "./ai-catalog.js";
import { resolveTaskModel } from "./ai-tasks.js";

// Back-compat shim: the single-global AgentConfig is now DERIVED from the per-task resolver
// (resolveTaskModel), so the executor's consumers (context/credentials/server) are untouched
// while routing goes per-task. build fields ← resolveTaskModel("build"); brain ← "plan".
export { DRIVABLE_HARNESSES };
export type { HarnessKind };

export type AgentConfig = {
    harnessKind: HarnessKind;
    harnessBin?: string;
    credMode: "subscription" | "apikey";
    brainProvider: string;
    brainModel?: string;
    brainBaseUrl?: string;
};

export function resolveAgentConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
    const b = resolveTaskModel("build", env);
    const brain = resolveTaskModel("plan", env);
    return {
        harnessKind: b.kind === "harness" ? b.harnessKind : "noop",
        harnessBin: b.kind === "harness" ? b.harnessBin : undefined,
        credMode: b.kind === "harness" ? b.credMode : "subscription",
        brainProvider: brain.kind === "model" ? brain.provider : "openrouter",
        brainModel: brain.kind === "model" ? brain.model : undefined,
        brainBaseUrl: brain.kind === "model" ? brain.baseUrl : undefined,
    };
}
