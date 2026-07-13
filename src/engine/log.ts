import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

// Per-run append-only NDJSON file = the cross-process log bus. The executor writes
// it; the web process's SSE route tails it (size-poll, partial-line-buffered). No
// sockets/IPC — the filesystem is the transport, and it gives replay/late-join for free.
export type LogInput =
  | { type: "status"; msg: string }
  | { type: "log"; stream?: "stdout" | "stderr"; msg: string }
  | { type: "end"; status: string; error?: string };
export type LogLine = LogInput & { t: number };

export function runDir(runId: string): string {
  return join(process.cwd(), config.runsDir, runId);
}
export function logPath(runId: string): string {
  return join(runDir(runId), "log.ndjson");
}

export class RunLog {
  constructor(private readonly runId: string) {
    mkdirSync(runDir(runId), { recursive: true });
  }

  write(line: LogInput): void {
    const rec: LogLine = { t: Date.now(), ...line };
    // One append = one atomic-enough write of a whole line ending in "\n"; the reader
    // buffers any trailing partial line, so a racing read never emits truncated JSON.
    appendFileSync(logPath(this.runId), `${JSON.stringify(rec)}\n`);
  }
}
