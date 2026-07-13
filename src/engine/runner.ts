import { sqlite } from "../db/index.js";
import type { Claim } from "./claim.js";
import { config } from "./config.js";
import type { EngineContext } from "./context.js";
import { RunLog } from "./log.js";

// Terminal DB writes, each a sub-ms IMMEDIATE txn (all guarded so a stale write is a
// no-op). Every UPDATE is conditioned on the row still being where we left it.
const SUCCEED_RUN = sqlite.prepare(
  `UPDATE run SET status = 'succeeded' WHERE id = ? AND status = 'running'`,
);
const DONE_ACTION = sqlite.prepare(
  `UPDATE action SET status = 'done' WHERE id = ? AND status = 'running'`,
);
const FAIL_RUN = sqlite.prepare(
  `UPDATE run SET status = 'failed', error = ? WHERE id = ? AND status = 'running'`,
);
const REQUEUE_ACTION = sqlite.prepare(
  `UPDATE action SET status = 'queued' WHERE id = ? AND status = 'running'`,
);
const BLOCK_ACTION = sqlite.prepare(
  `UPDATE action SET status = 'blocked' WHERE id = ? AND status = 'running'`,
);
const UNLOCK_COMPANY = sqlite.prepare(
  "UPDATE company SET locked_by_run_id = NULL WHERE id = ? AND locked_by_run_id = ?",
);

// Control-plane path: NO-OP build → done. Build steps 4-6 replace the middle with
// harness build → LocalProcessDeploy → distinct HTTP validate → awaiting_approval
// (which frees the concurrency slot but HOLDS the company lock through the gate).
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

export async function runOne(ctx: EngineContext, claim: Claim): Promise<void> {
  const log = new RunLog(claim.runId);
  const ac = new AbortController();
  const wall = setTimeout(() => ac.abort(), config.wallClockMs);
  log.write({
    type: "status",
    msg: `run started (action ${claim.actionId}, attempt ${claim.attempt})`,
  });

  try {
    const res = await ctx.harness.run(
      {
        runId: claim.runId,
        workdir: process.cwd(),
        prompt: "",
        systemPrompt: "",
        maxTurns: 1,
        wallClockMs: config.wallClockMs,
        env: {},
      },
      {
        onLine: (msg, stream) => log.write({ type: "log", stream, msg }),
        signal: ac.signal,
      },
    );
    if (!res.ok) throw new Error("harness reported failure / aborted");
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
