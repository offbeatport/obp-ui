import { config } from "./config.js";
import { buildEngineContext } from "./context.js";
import { DEBUG, VERBOSE } from "./debug.js";
import { startLoop } from "./loop.js";
import { bootReclaim, killInFlight } from "./reaper.js";

// The executor daemon - a standalone long-lived process (run via tsx) beside `vite dev`.
// It owns the whole run lifecycle and coordinates with the web process only through the
// WAL DB + per-run NDJSON log files. Kill it any time: all state is durable, so a fresh
// boot reclaims orphaned runs and resumes.
function main(): void {
    // FIRST line so it's unmistakable that debug tracing is on for this run.
    if (DEBUG)
        console.log(
            `[dbg] DEBUG MODE ON (CSLOP_DEBUG=${VERBOSE ? "verbose" : "1"}) — tracing model calls + engine passes${VERBOSE ? "; dumping full prompts + responses" : ""}`,
        );

    const ctx = buildEngineContext();
    console.log(`[engine] instance ${ctx.instanceId} starting`);

    const reclaimed = bootReclaim();
    if (reclaimed > 0) console.log(`[engine] boot-reclaimed ${reclaimed} orphaned run(s)`);

    const stop = startLoop(ctx);
    console.log(
        `[engine] loop running - poll ${config.pollMs}ms, concurrency ${config.maxConcurrentRuns}, harness ${ctx.resolveHarness().kind}`,
    );

    // Safety net: a single stray subprocess/async error must never take down the whole
    // executor (all concurrent runs). Log and keep the loop alive; DB state stays durable.
    process.on("uncaughtException", (e) =>
        console.error("[engine] uncaughtException (kept alive):", e),
    );
    process.on("unhandledRejection", (e) =>
        console.error("[engine] unhandledRejection (kept alive):", e),
    );

    const shutdown = (sig: string) => {
        const killed = killInFlight();
        console.log(
            `[engine] ${sig} - killed ${killed} in-flight child group(s); stopping loop (runs reclaimed on next boot)`,
        );
        stop();
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
