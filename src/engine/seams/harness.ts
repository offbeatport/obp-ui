import { setTimeout as sleep } from "node:timers/promises";
import type { Harness, HarnessIO, HarnessResult, HarnessTask } from "./types.js";

// NO-OP harness: no AI, no subprocess, no cost. It emits a few log lines over a few
// seconds so the whole control plane — claim → run → live log stream → done, plus
// lease/lock and crash-recovery — can be proven and measured before we ever spend
// agent tokens. Swapped for ClaudeCliHarness (real claude -p) in build step 4.
export class NoopHarness implements Harness {
  kind = "noop";

  async run(_task: HarnessTask, io: HarnessIO): Promise<HarnessResult> {
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      if (io.signal.aborted) return { ok: false, costUsd: 0 };
      io.onLine(`noop build: step ${i}/${steps}`);
      await sleep(600);
    }
    io.onLine("noop build: complete");
    return { ok: true, costUsd: 0 };
  }
}
