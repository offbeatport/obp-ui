import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sqlite } from "../db/index.js";
import type { Checkpoint } from "../db/schema.js";
import type { Claim } from "./claim.js";
import { config } from "./config.js";
import type { EngineContext } from "./context.js";
import { RunLog } from "./log.js";

const MAX_TURNS = 60;

// Terminal DB writes, each a sub-ms IMMEDIATE txn (all guarded so a stale write is a
// no-op). Every UPDATE is conditioned on the row still being where we left it.
const SUCCEED_RUN = sqlite.prepare(
  "UPDATE run SET status = 'succeeded' WHERE id = ? AND status = 'running'",
);
const DONE_ACTION = sqlite.prepare(
  "UPDATE action SET status = 'done' WHERE id = ? AND status = 'running'",
);
const FAIL_RUN = sqlite.prepare(
  "UPDATE run SET status = 'failed', error = ? WHERE id = ? AND status = 'running'",
);
const REQUEUE_ACTION = sqlite.prepare(
  "UPDATE action SET status = 'queued' WHERE id = ? AND status = 'running'",
);
const BLOCK_ACTION = sqlite.prepare(
  "UPDATE action SET status = 'blocked' WHERE id = ? AND status = 'running'",
);
const UNLOCK_COMPANY = sqlite.prepare(
  "UPDATE company SET locked_by_run_id = NULL WHERE id = ? AND locked_by_run_id = ?",
);

// checkpoint / cost / action-payload helpers
const GET_CHECKPOINT = sqlite.prepare("SELECT checkpoint FROM run WHERE id = ?");
const SET_CHECKPOINT = sqlite.prepare("UPDATE run SET checkpoint = ? WHERE id = ?");
const SET_COST = sqlite.prepare("UPDATE run SET cost_usd = ? WHERE id = ?");
const GET_ACTION = sqlite.prepare("SELECT title, payload FROM action WHERE id = ?");

const finishSucceed = sqlite.transaction((c: Claim) => {
  SUCCEED_RUN.run(c.runId);
  DONE_ACTION.run(c.actionId);
  UNLOCK_COMPANY.run(c.companyId, c.runId);
});

const finishFail = sqlite.transaction((c: Claim, err: string) => {
  FAIL_RUN.run(err, c.runId);
  if (c.attempt + 1 >= config.maxAttempts) BLOCK_ACTION.run(c.actionId);
  else REQUEUE_ACTION.run(c.actionId);
  UNLOCK_COMPANY.run(c.companyId, c.runId);
});

function patchCheckpoint(runId: string, patch: Partial<Checkpoint>): void {
  const row = GET_CHECKPOINT.get(runId) as { checkpoint: string | null } | undefined;
  const cur: Checkpoint = row?.checkpoint ? JSON.parse(row.checkpoint) : {};
  SET_CHECKPOINT.run(JSON.stringify({ ...cur, ...patch }), runId);
}

const SYSTEM_PROMPT = loadSystemPrompt();
function loadSystemPrompt(): string {
  try {
    return readFileSync(join(process.cwd(), "prompts", "harness-system.md"), "utf8");
  } catch {
    return "";
  }
}

function buildPrompt(actionId: string): string {
  const a = GET_ACTION.get(actionId) as { title: string; payload: string } | undefined;
  if (!a) return "Ship the walking-skeleton feature described in AGENTS.md.";
  let doneWhen = "";
  try {
    doneWhen = (JSON.parse(a.payload) as { doneWhen?: string }).doneWhen ?? "";
  } catch {
    /* payload not JSON */
  }
  return [
    "Build this feature for the app in the current working directory:",
    "",
    a.title,
    "",
    doneWhen ? `Acceptance (doneWhen): ${doneWhen}` : "",
    "",
    "Read AGENTS.md and slop/ first. Follow the system contract exactly. Ship the thinnest",
    "working version that satisfies the acceptance check, then stop.",
  ].join("\n");
}

export async function runOne(ctx: EngineContext, claim: Claim): Promise<void> {
  const log = new RunLog(claim.runId);
  const ac = new AbortController();
  const wall = setTimeout(() => ac.abort(), config.wallClockMs);
  const real = ctx.harness.kind !== "noop";
  log.write({
    type: "status",
    msg: `run started (action ${claim.actionId}, attempt ${claim.attempt})`,
  });

  try {
    // Real harness builds inside the company's git worktree; the NO-OP runs in place.
    let workdir = process.cwd();
    if (real) {
      const repo = await ctx.git.ensureRepo(claim.companyId);
      workdir = repo.workdir;
    }

    const res = await ctx.harness.run(
      {
        runId: claim.runId,
        workdir,
        prompt: real ? buildPrompt(claim.actionId) : "",
        systemPrompt: real ? SYSTEM_PROMPT : "",
        maxTurns: MAX_TURNS,
        wallClockMs: config.wallClockMs,
        env: {},
      },
      {
        onLine: (msg, stream) => log.write({ type: "log", stream, msg }),
        onSpawn: ({ pgid }) => patchCheckpoint(claim.runId, { agentPgid: pgid }),
        signal: ac.signal,
      },
    );

    if (res.costUsd > 0) SET_COST.run(res.costUsd, claim.runId);
    if (!res.ok) throw new Error("harness reported failure / aborted");

    if (real) {
      const sha = await ctx.git.commitAll(
        workdir,
        claim.runId,
        `feat: build action ${claim.actionId}`,
      );
      patchCheckpoint(claim.runId, { gitSha: sha, sessionId: res.sessionId });
      log.write({ type: "status", msg: `checkpoint ${sha.slice(0, 8)}` });
    }

    // TODO(step 5-6): insert deploy → distinct HTTP validate → awaiting_approval → ship-on-approve
    // BETWEEN the build above and this terminal transition. Until then a real build lands as
    // `done` WITHOUT validation — so keep autopilot off and treat these runs as unproven.
    finishSucceed.immediate(claim);
    log.write({ type: "end", status: "succeeded" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishFail.immediate(claim, msg);
    log.write({ type: "end", status: "failed", error: msg });
  } finally {
    clearTimeout(wall);
  }
}
