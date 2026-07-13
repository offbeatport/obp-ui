import { randomUUID } from "node:crypto";
import { NoopHarness } from "./seams/harness.js";
import type { Harness } from "./seams/types.js";

// DI root: wire the seams once at boot. A fresh instanceId stamps every run this
// executor owns (single-executor invariant + crash-recovery ownership).
export type EngineContext = {
  instanceId: string;
  harness: Harness;
  // sandbox / deploy / git / validator wired in build steps 4-6.
};

export function buildEngineContext(): EngineContext {
  return {
    instanceId: randomUUID(),
    harness: new NoopHarness(),
  };
}
