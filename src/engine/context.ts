import { randomUUID } from "node:crypto";
import { resolveAgentConfig } from "../config/agent.js";
import { config } from "./config.js";
import { DbBackedCredentials } from "./seams/credentials.js";
import { LocalDeploy } from "./seams/deploy.js";
import { LocalGitProvider } from "./seams/git.js";
import { ClaudeCliHarness, FixtureHarness, NoopHarness } from "./seams/harness.js";
import { LocalShell } from "./seams/sandbox.js";
import type { Git, Harness, Validator } from "./seams/types.js";
import { HttpValidator } from "./seams/validator.js";

// DI root: wire the seams once at boot. A fresh instanceId stamps every run this
// executor owns (single-executor invariant + crash-recovery ownership). (sandbox + credentials
// are locals below, consumed by deploy + ClaudeCliHarness - nothing downstream reads them.)
export type EngineContext = {
    instanceId: string;
    // resolved PER-RUN (reads app_config/env each call) so a Settings/onboarding save picks a
    // new builder on the next claimed run without bouncing the daemon.
    resolveHarness: () => Harness;
    git: Git;
    deploy: LocalDeploy;
    validator: Validator;
};

export function buildEngineContext(): EngineContext {
    const credentials = new DbBackedCredentials();
    const sandbox = new LocalShell();
    const git = new LocalGitProvider();
    const deploy = new LocalDeploy(sandbox, config.portRange);
    const validator = new HttpValidator();
    const noop = new NoopHarness();
    const fixture = new FixtureHarness();
    const fixtureFlaky = new FixtureHarness(true);

    // Default = NO-OP (zero setup). Set agent.harness='claude' (Settings/onboarding) or
    // CSLOP_HARNESS=claude to build for real - resolved fresh each run. CSLOP_HARNESS=fixture
    // is the engine's own zero-cost e2e seam (real build path, canned artifact); fixture-flaky
    // fails the first build then fixes it, to exercise the iterate-to-green loop.
    const resolveHarness = (): Harness => {
        if (process.env.CSLOP_HARNESS === "fixture") return fixture;
        if (process.env.CSLOP_HARNESS === "fixture-flaky") return fixtureFlaky;
        const cfg = resolveAgentConfig();
        return cfg.harnessKind === "claude" ? new ClaudeCliHarness(sandbox, credentials, cfg.harnessBin) : noop;
    };

    return {
        instanceId: randomUUID(),
        resolveHarness,
        git,
        deploy,
        validator,
    };
}
