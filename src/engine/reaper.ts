import { sqlite } from "../db/index.js";
import type { Checkpoint } from "../db/schema.js";
import { config } from "./config.js";

// Crash recovery. Git-sha replay is the correctness anchor; recovery kills orphaned
// process groups, cleans the worktree back to the checkpoint, then requeues (or blocks
// at max attempts) and releases the company lock — so a killed executor never strands a
// lock or leaks a subprocess.

type RunRow = {
  id: string;
  action_id: string;
  company_id: string;
  attempt: number;
  checkpoint: string | null;
};

// Single-executor invariant: nothing is legitimately 'running' at boot.
const SELECT_RUNNING_ALL = sqlite.prepare(
  `SELECT id, action_id, company_id, attempt, checkpoint FROM run WHERE status = 'running'`,
);
// Periodic sweep only (future multi-executor path): a run whose lease lapsed.
const SELECT_LEASE_EXPIRED = sqlite.prepare(
  `SELECT id, action_id, company_id, attempt, checkpoint FROM run WHERE status = 'running' AND lease_expires_at < ?`,
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
const RENEW_LEASE = sqlite.prepare(
  `UPDATE run SET lease_expires_at = ? WHERE id = ? AND status = 'running'`,
);

// DB side of reclaim: sub-ms writes in one IMMEDIATE txn (kills/git run outside it).
const reclaimTxn = sqlite.transaction((run: RunRow, reason: string) => {
  FAIL_RUN.run(reason, run.id);
  if (run.attempt + 1 >= config.maxAttempts) BLOCK_ACTION.run(run.action_id);
  else REQUEUE_ACTION.run(run.action_id);
  UNLOCK_COMPANY.run(run.company_id, run.id);
});

function reclaimOne(run: RunRow, reason: string): void {
  const cp: Checkpoint = run.checkpoint ? JSON.parse(run.checkpoint) : {};
  // Kill orphaned process groups BEFORE any git op so a live orphan can't race the
  // worktree clean. No-op until real subprocesses exist (build steps 4-5).
  killPgid(cp.agentPgid);
  killPgid(cp.deployPgid);
  // TODO(step 4-5): Git.resetClean(workdir, cp.gitSha) + Deploy.reconcile() here, once
  // companies have real repos and deploys.
  reclaimTxn.immediate(run, reason);
}

// Boot: reclaim ALL non-terminal running runs unconditionally (NOT lease-gated — a run
// that crashed seconds ago still has a future lease, and gating on it would strand the
// company lock for a full lease).
export function bootReclaim(): number {
  const rows = SELECT_RUNNING_ALL.all() as RunRow[];
  for (const r of rows) reclaimOne(r, "reclaimed at executor boot");
  return rows.length;
}

// Periodic sweep: reserved for the future multi-executor path. Skips runs THIS instance
// is actively driving so a transient lease lapse can't reclaim a live run.
export function sweepExpiredLeases(active: Set<string>): number {
  const rows = SELECT_LEASE_EXPIRED.all(Date.now()) as RunRow[];
  let n = 0;
  for (const r of rows) {
    if (active.has(r.id)) continue;
    reclaimOne(r, "lease expired");
    n++;
  }
  return n;
}

export function renewLease(runId: string): void {
  RENEW_LEASE.run(Date.now() + config.leaseMs, runId);
}

// Kill the process groups of all in-flight runs (used on graceful shutdown so detached
// children — which don't receive the terminal's SIGINT — don't run on orphaned, burning
// tokens with no wall-clock cap until the next boot reap). DB reclaim happens on next boot.
export function killInFlight(): number {
  const rows = SELECT_RUNNING_ALL.all() as RunRow[];
  for (const r of rows) {
    const cp: Checkpoint = r.checkpoint ? JSON.parse(r.checkpoint) : {};
    killPgid(cp.agentPgid);
    killPgid(cp.deployPgid);
  }
  return rows.length;
}

function killPgid(pgid?: number): void {
  if (!pgid || pgid <= 0) return; // never let -pgid become a positive PID (e.g. kill(1))
  try {
    process.kill(-pgid, "SIGKILL");
  } catch {
    // already gone
  }
}
