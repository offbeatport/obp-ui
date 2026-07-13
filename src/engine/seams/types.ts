import type { Readable } from "node:stream";

// The five seams that make the engine one system across placements (local open-core
// now, hosted multi-tenant later). Each is a narrow TS interface with ONE local v1
// impl today and a named hosted impl later, so the cloud swap is a drop-in — never a
// rewrite. Only Harness has a concrete impl in the spine's control-plane phase
// (NoopHarness); Sandbox/Deploy/Git/Validator interfaces are defined here now to lock
// the boundary and get their local impls in build steps 4-6.

// ---- Harness: the coding agent's "hands" (claude -p now, codex/aider/OpenRouter later) ----
export type HarnessTask = {
  runId: string;
  workdir: string;
  prompt: string;
  systemPrompt: string;
  sessionId?: string;
  maxTurns: number;
  wallClockMs: number;
  env: Record<string, string>;
};
export type HarnessIO = {
  onLine: (msg: string, stream?: "stdout" | "stderr") => void;
  signal: AbortSignal;
};
export type HarnessResult = { ok: boolean; sessionId?: string; costUsd: number };
export interface Harness {
  kind: string;
  run(task: HarnessTask, io: HarnessIO): Promise<HarnessResult>;
}

// ---- Sandbox: WHERE the subprocess runs (host process group now, microVM/container later) ----
export type SpawnSpec = {
  cmd: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  stdin?: string;
};
export type SandboxProc = {
  pid: number;
  pgid: number;
  stdout: Readable;
  stderr: Readable;
  wait(): Promise<{ code: number | null }>;
};
export interface Sandbox {
  kind: string;
  spawn(spec: SpawnSpec): SandboxProc;
  kill(pgid: number): Promise<void>;
}

// ---- Deploy: how the built app gets a live URL doneWhen can hit ----
export type DeploySpec = {
  companyId: string;
  workdir: string;
  startCmd: string;
  healthPath: string;
};
export type Deployment = { url: string; pid: number; pgid: number; port: number };
export interface Deploy {
  kind: string;
  up(spec: DeploySpec): Promise<Deployment>;
  down(companyId: string): Promise<void>;
  reconcile(liveRunIds: string[]): Promise<void>;
}

// ---- Git: the company's git backbone (bare local repo now, Gitea/GitHub org later) ----
export interface Git {
  kind: string;
  ensureRepo(companyId: string): Promise<{ workdir: string }>;
  seedSha(companyId: string): Promise<string>;
  commitAll(workdir: string, runId: string, msg: string): Promise<string>;
  resetClean(workdir: string, sha: string): Promise<void>;
  promote(companyId: string, sha: string): Promise<void>;
  pruneWorktrees(companyId: string): Promise<void>;
}

// ---- Validator: the DISTINCT check that flips a code action done (builder never self-certifies) ----
export type DoneWhenSpec = { url: string; kind: "http-signup" };
export interface Validator {
  check(spec: DoneWhenSpec): Promise<{ green: boolean; detail: string }>;
}
