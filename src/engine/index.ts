import { config } from "./config.js";
import { buildEngineContext } from "./context.js";
import { startLoop } from "./loop.js";
import { bootReclaim } from "./reaper.js";

// The executor daemon — a standalone long-lived process (run via tsx) beside `vite dev`.
// It owns the whole run lifecycle and coordinates with the web process only through the
// WAL DB + per-run NDJSON log files. Kill it any time: all state is durable, so a fresh
// boot reclaims orphaned runs and resumes.
function main(): void {
  const ctx = buildEngineContext();
  console.log(`[engine] instance ${ctx.instanceId} starting`);

  const reclaimed = bootReclaim();
  if (reclaimed > 0) console.log(`[engine] boot-reclaimed ${reclaimed} orphaned run(s)`);

  const stop = startLoop(ctx);
  console.log(
    `[engine] loop running — poll ${config.pollMs}ms, concurrency ${config.maxConcurrentRuns}, harness ${ctx.harness.kind}`,
  );

  const shutdown = (sig: string) => {
    console.log(`[engine] ${sig} — stopping loop (in-flight runs reclaimed on next boot)`);
    stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
