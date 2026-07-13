import { randomUUID } from "node:crypto";
import { EnvCredentials } from "./seams/credentials.js";
import type { Credentials } from "./seams/credentials.js";
import { LocalGitProvider } from "./seams/git.js";
import { ClaudeCliHarness, NoopHarness } from "./seams/harness.js";
import { LocalShell } from "./seams/sandbox.js";
import type { Git, Harness, Sandbox } from "./seams/types.js";

// DI root: wire the seams once at boot. A fresh instanceId stamps every run this
// executor owns (single-executor invariant + crash-recovery ownership).
export type EngineContext = {
  instanceId: string;
  harness: Harness;
  sandbox: Sandbox;
  git: Git;
  credentials: Credentials;
  // deploy / validator wired in build step 5.
};

export function buildEngineContext(): EngineContext {
  const credentials = new EnvCredentials();
  const sandbox = new LocalShell();
  const git = new LocalGitProvider();

  // Default to the NO-OP harness so the control plane runs with zero setup.
  // Opt into the real builder with CSLOP_HARNESS=claude (needs a claude login on the host).
  const harness: Harness =
    process.env.CSLOP_HARNESS === "claude"
      ? new ClaudeCliHarness(sandbox, credentials)
      : new NoopHarness();

  return { instanceId: randomUUID(), harness, sandbox, git, credentials };
}
