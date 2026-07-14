import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Credentials } from "./credentials.js";
import type { Harness, HarnessIO, HarnessResult, HarnessTask, Sandbox } from "./types.js";

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

// FixtureHarness — a deterministic, zero-cost builder (kind "fixture", NOT "noop", so the
// runner treats it as a real build and runs the deploy → validate → ship path). It just
// drops the reference `server.js` into the workdir, letting the WHOLE spine be proven
// end-to-end without a `claude` login or a single token spent. Opt in with
// CSLOP_HARNESS=fixture (engine test seam only — never a user-selectable harness).
export class FixtureHarness implements Harness {
    kind = "fixture";

    async run(task: HarnessTask, io: HarnessIO): Promise<HarnessResult> {
        if (io.signal.aborted) return { ok: false, costUsd: 0 };
        io.onLine("fixture build: writing reference signup server.js");
        const here = dirname(fileURLToPath(import.meta.url));
        copyFileSync(join(here, "fixtures", "signup-server.js"), join(task.workdir, "server.js"));
        io.onLine("fixture build: complete");
        return { ok: true, sessionId: task.runId, costUsd: 0 };
    }
}

// ClaudeCliHarness — the v1 real harness: drives `claude -p` inside the injected Sandbox,
// in the company's git worktree, iterating to a working app. stream-json → NDJSON log lines;
// the prompt goes via stdin (avoids ARG_MAX); the run id (a UUID) is the claude session id.
//
// NOT yet exercised end-to-end — needs a `claude` binary + host login (see docs/RUNBOOK.md).
// The AI proxy (OpenRouter, thinking tasks) is a separate path; this is the build "hands".
export class ClaudeCliHarness implements Harness {
    kind = "claude";

    constructor(
        private readonly sandbox: Sandbox,
        private readonly creds: Credentials,
        private readonly bin = process.env.CSLOP_HARNESS_BIN ?? "claude",
    ) {}

    async run(task: HarnessTask, io: HarnessIO): Promise<HarnessResult> {
        const args = [
            "-p",
            "--output-format",
            "stream-json",
            "--verbose",
            "--dangerously-skip-permissions",
            "--session-id",
            task.runId,
        ];
        if (task.systemPrompt) args.push("--append-system-prompt", task.systemPrompt);
        if (task.maxTurns > 0) args.push("--max-turns", String(task.maxTurns));

        const proc = this.sandbox.spawn({
            cmd: this.bin,
            args,
            cwd: task.workdir,
            env: { ...task.env, ...this.creds.harnessEnv() },
            stdin: task.prompt,
        });
        io.onSpawn?.({ pid: proc.pid, pgid: proc.pgid });

        const onAbort = () => void this.sandbox.kill(proc.pgid);
        io.signal.addEventListener("abort", onAbort);

        let ok = false;
        let costUsd = 0;
        let sessionId = task.runId;

        const stdout = parseNdjson(proc.stdout, (evt) => {
            if (evt.type === "result") {
                ok = evt.subtype === "success" || evt.is_error === false;
                if (typeof evt.total_cost_usd === "number") costUsd = evt.total_cost_usd;
                if (typeof evt.session_id === "string") sessionId = evt.session_id;
            }
            const line = summarizeEvent(evt);
            if (line) io.onLine(line);
        });
        proc.stderr.on("data", (b: Buffer) => {
            const s = b.toString().trimEnd();
            if (s) io.onLine(s, "stderr");
        });

        const [{ code }] = await Promise.all([proc.wait(), stdout]);
        io.signal.removeEventListener("abort", onAbort);

        if (io.signal.aborted) return { ok: false, sessionId, costUsd };
        return { ok: ok && code === 0, sessionId, costUsd };
    }
}

type StreamEvent = {
    type?: string;
    subtype?: string;
    is_error?: boolean;
    total_cost_usd?: number;
    session_id?: string;
    message?: { content?: Array<{ type?: string; text?: string; name?: string }> };
    [k: string]: unknown;
};

// Parse claude's stream-json stdout (one JSON object per line), buffering partial lines.
function parseNdjson(stream: Readable, onEvent: (e: StreamEvent) => void): Promise<void> {
    return new Promise((resolve) => {
        let buf = "";
        stream.on("data", (chunk: Buffer) => {
            buf += chunk.toString();
            let nl = buf.indexOf("\n");
            while (nl >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (line) {
                    try {
                        onEvent(JSON.parse(line) as StreamEvent);
                    } catch {
                        /* non-JSON line — ignore */
                    }
                }
                nl = buf.indexOf("\n");
            }
        });
        stream.on("close", () => resolve());
        stream.on("end", () => resolve());
    });
}

// Compact a stream event into one readable log line.
function summarizeEvent(evt: StreamEvent): string | null {
    if (evt.type === "assistant" && evt.message?.content) {
        const parts = evt.message.content
            .map((c) => (c.type === "text" ? c.text : c.name ? `→ ${c.name}` : ""))
            .filter(Boolean)
            .join(" ");
        return parts ? parts.slice(0, 500) : null;
    }
    if (evt.type === "result") {
        return `result: ${evt.subtype ?? (evt.is_error ? "error" : "ok")}${
            typeof evt.total_cost_usd === "number" ? ` ($${evt.total_cost_usd.toFixed(4)})` : ""
        }`;
    }
    return null;
}
