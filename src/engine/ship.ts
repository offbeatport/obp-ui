import { randomUUID } from "node:crypto";
import { sqlite } from "../db/index.js";
import type { Checkpoint } from "../db/schema.js";
import type { EngineContext } from "./context.js";
import { RunLog } from "./log.js";

// Ship driver - the terminal rung. An action reaches `approved` two ways: you clicked
// Approve (L0), or bounded autopilot auto-approved a reversible green code action (L1).
// Either way this promotes the run's checkpoint sha onto the company's `main`, flips the
// action `done` + run `succeeded`, records a system activity message, and releases the
// company lock. Git promote (irreversible-ish) runs FIRST, outside the txn; only on its
// success do the sub-ms guarded DB writes flip terminal state - so a crash mid-ship
// leaves the action `approved` and the next tick retries idempotently.

type ApprovedRow = {
    action_id: string;
    company_id: string;
    title: string;
    run_id: string;
    checkpoint: string | null;
};

const SELECT_APPROVED = sqlite.prepare(`
  SELECT a.id AS action_id, a.company_id AS company_id, a.title AS title,
         r.id AS run_id, r.checkpoint AS checkpoint
  FROM action a
  JOIN run r ON r.action_id = a.id AND r.status = 'awaiting_approval'
  WHERE a.status = 'approved'
`);

const DONE_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'done' WHERE id = ? AND status = 'approved'",
);
const SUCCEED_RUN = sqlite.prepare(
    "UPDATE run SET status = 'succeeded' WHERE id = ? AND status = 'awaiting_approval'",
);
const UNLOCK_COMPANY = sqlite.prepare(
    "UPDATE company SET locked_by_run_id = NULL WHERE id = ? AND locked_by_run_id = ?",
);
const INSERT_MESSAGE = sqlite.prepare(
    "INSERT INTO message (id, company_id, role, content, created_at) VALUES (?, ?, 'system', ?, ?)",
);

const shipTxn = sqlite.transaction((row: ApprovedRow) => {
    DONE_ACTION.run(row.action_id);
    SUCCEED_RUN.run(row.run_id);
    UNLOCK_COMPANY.run(row.company_id, row.run_id);
    INSERT_MESSAGE.run(randomUUID(), row.company_id, `Shipped: ${row.title}`, Date.now());
});

// Promote every currently-approved action. `shipping` dedupes across ticks so a slow git
// promote can't be started twice; the guarded UPDATEs make a double-fire a harmless no-op.
export async function shipApproved(ctx: EngineContext, shipping: Set<string>): Promise<void> {
    const rows = SELECT_APPROVED.all() as ApprovedRow[];
    for (const row of rows) {
        if (shipping.has(row.action_id)) continue;
        // Parse defensively: a malformed checkpoint must skip this row, not throw out of a
        // fire-and-forget shipApproved (which would surface as an unhandledRejection).
        let cp: Checkpoint;
        try {
            cp = row.checkpoint ? (JSON.parse(row.checkpoint) as Checkpoint) : {};
        } catch {
            continue;
        }
        if (!cp.gitSha) continue; // nothing to promote (shouldn't happen post-validate)
        shipping.add(row.action_id);
        void shipOne(ctx, row, cp.gitSha).finally(() => shipping.delete(row.action_id));
    }
}

async function shipOne(ctx: EngineContext, row: ApprovedRow, sha: string): Promise<void> {
    const log = new RunLog(row.run_id);
    try {
        await ctx.git.promote(row.company_id, sha);
        ctx.deploy.persist(row.company_id); // keep the live URL up after ship
        shipTxn.immediate(row);
        log.write({ type: "status", msg: `promoted ${sha.slice(0, 8)} → main` });
        log.write({ type: "status", msg: `shipped: ${row.title}` });
        log.write({ type: "end", status: "succeeded" });
    } catch (err) {
        // Leave the action `approved`; the next tick retries. Surface it in the run log.
        log.write({
            type: "status",
            msg: `ship failed (will retry): ${err instanceof Error ? err.message : String(err)}`,
        });
    }
}
