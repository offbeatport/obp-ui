import { randomUUID } from "node:crypto";
import { resolveAgentConfig } from "../config/agent.js";
import type { Credentials } from "./seams/credentials.js";
import { DbBackedCredentials } from "./seams/credentials.js";
import { LocalGitProvider } from "./seams/git.js";
import { ClaudeCliHarness, NoopHarness } from "./seams/harness.js";
import { LocalShell } from "./seams/sandbox.js";
import type { Git, Harness, Sandbox } from "./seams/types.js";

// DI root: wire the seams once at boot. A fresh instanceId stamps every run this
// executor owns (single-executor invariant + crash-recovery ownership).
export type EngineContext = {
    instanceId: string;
    // resolved PER-RUN (reads app_config/env each call) so a Settings/onboarding save picks a
    // new builder on the next claimed run without bouncing the daemon.
    resolveHarness: () => Harness;
    sandbox: Sandbox;
    git: Git;
    credentials: Credentials;
    // deploy / validator wired in build step 5.
};

export function buildEngineContext(): EngineContext {
    const credentials = new DbBackedCredentials();
    const sandbox = new LocalShell();
    const git = new LocalGitProvider();
    const noop = new NoopHarness();

    // Default = NO-OP (zero setup). Set agent.harness='claude' (Settings/onboarding) or
    // CSLOP_HARNESS=claude to build for real — resolved fresh each run.
    const resolveHarness = (): Harness => {
        const cfg = resolveAgentConfig();
        return cfg.harnessKind === "claude"
            ? new ClaudeCliHarness(sandbox, credentials, cfg.harnessBin)
            : noop;
    };

    return { instanceId: randomUUID(), resolveHarness, sandbox, git, credentials };
}
