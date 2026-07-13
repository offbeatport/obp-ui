import { claimNext } from "./claim.js";
import { config } from "./config.js";
import type { EngineContext } from "./context.js";
import { renewLease, sweepExpiredLeases } from "./reaper.js";
import { runOne } from "./runner.js";

// The continuous priority loop. Poll (not events) to eliminate the missed-wakeup bug
// class; an in-memory `active` set bounds concurrency. claimNext is synchronous
// better-sqlite3 — fine here because this is the dedicated executor process, not the
// HTTP/SSR event loop.
export function startLoop(ctx: EngineContext): () => void {
  const active = new Set<string>();

  const tick = () => {
    // ship driver for 'approved' actions lands in build step 6.
    while (active.size < config.maxConcurrentRuns) {
      const claim = claimNext(ctx.instanceId);
      if (!claim) break;
      active.add(claim.runId);
      runOne(ctx, claim).finally(() => active.delete(claim.runId));
    }
  };

  const heartbeat = () => {
    for (const runId of active) renewLease(runId);
  };

  const pollTimer = setInterval(tick, config.pollMs);
  const hbTimer = setInterval(heartbeat, config.heartbeatMs);
  const sweepTimer = setInterval(() => sweepExpiredLeases(active), config.leaseMs);
  tick();

  return () => {
    clearInterval(pollTimer);
    clearInterval(hbTimer);
    clearInterval(sweepTimer);
  };
}
