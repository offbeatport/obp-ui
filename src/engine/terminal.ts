import { sqlite } from "../db/index.js";

// Terminal run/action state transitions shared by the runner (in-run failure/success) and the
// reaper (crash/lease reclaim). Each is guarded to the 'running' resting state so a double-fire
// is a harmless no-op. Callers compose these inside their own IMMEDIATE transaction.
export const FAIL_RUN = sqlite.prepare(
    "UPDATE run SET status = 'failed', error = ? WHERE id = ? AND status = 'running'",
);
export const REQUEUE_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'queued' WHERE id = ? AND status = 'running'",
);
export const BLOCK_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'blocked' WHERE id = ? AND status = 'running'",
);
export const UNLOCK_COMPANY = sqlite.prepare(
    "UPDATE company SET locked_by_run_id = NULL WHERE id = ? AND locked_by_run_id = ?",
);
