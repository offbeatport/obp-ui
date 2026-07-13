import { randomUUID } from "node:crypto";
import { sqlite } from "../db/index.js";
import { config } from "./config.js";

export type Claim = {
  runId: string;
  actionId: string;
  companyId: string;
  attempt: number;
};

// Top-priority READY code action: queued, its company active + unlocked, all deps
// done, and under budget. Budget guard is null-safe — `x < NULL` is NULL (falsy), so
// `(cap IS NULL OR sum < cap)` is required or capless companies stall forever.
const SELECT_NEXT = sqlite.prepare(`
  SELECT a.id AS action_id, a.company_id AS company_id
  FROM action a
  JOIN company c ON c.id = a.company_id
  WHERE a.status = 'queued'
    AND a.type = 'code'
    AND c.status = 'active'
    AND c.locked_by_run_id IS NULL
    AND (
      a.depends_on IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM json_each(a.depends_on) d
        JOIN action dep ON dep.id = d.value
        WHERE dep.status != 'done'
      )
    )
    AND (
      c.budget_cap_usd IS NULL
      OR (SELECT COALESCE(SUM(r.cost_usd), 0) FROM run r WHERE r.company_id = c.id) < c.budget_cap_usd
    )
  ORDER BY a.priority DESC, a.created_at ASC
  LIMIT 1
`);

const COUNT_ATTEMPTS = sqlite.prepare("SELECT COUNT(*) AS n FROM run WHERE action_id = ?");

const INSERT_RUN = sqlite.prepare(`
  INSERT INTO run (id, action_id, company_id, status, attempt, checkpoint, cost_usd, agent_kind, lease_expires_at, created_at)
  VALUES (@id, @actionId, @companyId, 'running', @attempt, @checkpoint, 0, @agentKind, @lease, @now)
`);
const SET_ACTION_RUNNING = sqlite.prepare(
  `UPDATE action SET status = 'running' WHERE id = ? AND status = 'queued'`,
);
const LOCK_COMPANY = sqlite.prepare(
  "UPDATE company SET locked_by_run_id = ? WHERE id = ? AND locked_by_run_id IS NULL",
);

// One BEGIN IMMEDIATE transaction, sub-millisecond writes ONLY. All build/deploy/agent
// work happens strictly outside it: holding the single WAL writer lock across
// subprocess work would stall every other writer (the web process's approve/enqueue).
const claimTxn = sqlite.transaction((instanceId: string): Claim | null => {
  const row = SELECT_NEXT.get() as { action_id: string; company_id: string } | undefined;
  if (!row) return null;
  const { action_id: actionId, company_id: companyId } = row;

  const attempt = (COUNT_ATTEMPTS.get(actionId) as { n: number }).n;
  const runId = randomUUID();
  const now = Date.now();

  INSERT_RUN.run({
    id: runId,
    actionId,
    companyId,
    attempt,
    checkpoint: JSON.stringify({ instanceId }),
    agentKind: "noop",
    lease: now + config.leaseMs,
    now,
  });
  if (SET_ACTION_RUNNING.run(actionId).changes !== 1) {
    throw new Error("claim race: action no longer queued");
  }
  // The company-lock CAS is the real cross-process guard: if a second claimer slipped
  // in, changes()===0 and we roll the whole txn back.
  if (LOCK_COMPANY.run(runId, companyId).changes !== 1) {
    throw new Error("claim race: company already locked");
  }
  return { runId, actionId, companyId, attempt };
});

// Runs BEGIN IMMEDIATE. SQLITE_BUSY/BUSY_SNAPSHOT (a write colliding with the web
// process past busy_timeout) is "no claim this tick" — retry next poll, never throw
// out of the loop.
export function claimNext(instanceId: string): Claim | null {
  try {
    return claimTxn.immediate(instanceId);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code.startsWith("SQLITE_BUSY")) return null;
    throw err;
  }
}
