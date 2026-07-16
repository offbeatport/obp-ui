import { answerNext } from "./chat.js";
import { claimNext } from "./claim.js";
import { config } from "./config.js";
import type { EngineContext } from "./context.js";
import { renewLease, sweepExpiredLeases } from "./reaper.js";
import { runOne } from "./runner.js";
import { scopeNext } from "./scope.js";
import { shipApproved } from "./ship.js";
import { spinChat, spinScout, spinSpec } from "./spin.js";

// The continuous priority loop. Poll (not events) to eliminate the missed-wakeup bug
// class; an in-memory `active` set bounds concurrency. claimNext is synchronous
// better-sqlite3 - fine here because this is the dedicated executor process, not the
// HTTP/SSR event loop.
export function startLoop(ctx: EngineContext): () => void {
    const active = new Set<string>();
    const shipping = new Set<string>();
    const scoping = new Set<string>();
    const chatting = new Set<string>();
    const scouting = new Set<string>();
    const specing = new Set<string>();
    const spinChatting = new Set<string>();

    const tick = () => {
        // Ship first: promote any action you (or autopilot) approved since last tick, which
        // also releases the company lock so its next queued action becomes claimable below.
        void shipApproved(ctx, shipping);
        // Thinking passes - each processes at most ONE company per tick (bounded fan-out so
        // scoping/chat can't spawn a claude-subprocess thundering herd). They own their own
        // guard Sets and do all AI outside any DB transaction.
        void scopeNext(scoping); // fresh company thought → opportunity + spec + first action
        void answerNext(chatting); // an unanswered user turn in a scoped company's chat
        void spinScout(scouting); // a 'scouting' draft → 5 full opportunity specs (+ .md in git)
        void spinSpec(specing); // a 'specing' draft (picked) → full company spec + branding
        void spinChat(spinChatting); // an unanswered chat turn in a spin draft → reply + intent
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
