import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sqlite } from "../db/index.js";
import type { Checkpoint, CodePayload } from "../db/schema.js";
import type { Claim } from "./claim.js";
import { config } from "./config.js";
import type { EngineContext } from "./context.js";
import { RunLog } from "./log.js";
import type { HarnessIO } from "./seams/types.js";
import { BLOCK_ACTION, FAIL_RUN, REQUEUE_ACTION, UNLOCK_COMPANY } from "./terminal.js";

const MAX_TURNS = 60;

// Terminal DB writes, each a sub-ms IMMEDIATE txn (all guarded so a stale write is a
// no-op). Every UPDATE is conditioned on the row still being where we left it.
const SUCCEED_RUN = sqlite.prepare(
    "UPDATE run SET status = 'succeeded' WHERE id = ? AND status = 'running'",
);
const DONE_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'done' WHERE id = ? AND status = 'running'",
);

// Approval-gate writes: a green run lands here instead of `done`. The company stays LOCKED
// until the ship driver promotes it (see src/engine/ship.ts) - the gate is a resting state.
const AWAIT_RUN = sqlite.prepare(
    "UPDATE run SET status = 'awaiting_approval' WHERE id = ? AND status = 'running'",
);
const AWAIT_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'awaiting_approval' WHERE id = ? AND status = 'running'",
);
const AUTO_APPROVE_ACTION = sqlite.prepare(
    "UPDATE action SET status = 'approved' WHERE id = ? AND status = 'running'",
);

// checkpoint / cost / action-payload helpers
const GET_CHECKPOINT = sqlite.prepare("SELECT checkpoint FROM run WHERE id = ?");
const SET_CHECKPOINT = sqlite.prepare("UPDATE run SET checkpoint = ? WHERE id = ?");
const SET_COST = sqlite.prepare("UPDATE run SET cost_usd = ? WHERE id = ?");
const GET_ACTION = sqlite.prepare("SELECT title, payload FROM action WHERE id = ?");
const SET_PAYLOAD = sqlite.prepare("UPDATE action SET payload = ? WHERE id = ?");
// The one autopilot rule: a reversible code action may auto-run on green.
const GET_GATE = sqlite.prepare(
    "SELECT c.autopilot AS autopilot, a.reversible AS reversible, a.type AS type " +
        "FROM action a JOIN company c ON c.id = a.company_id WHERE a.id = ?",
);

const finishSucceed = sqlite.transaction((c: Claim) => {
    SUCCEED_RUN.run(c.runId);
    DONE_ACTION.run(c.actionId);
    UNLOCK_COMPANY.run(c.companyId, c.runId);
});

const finishFail = sqlite.transaction((c: Claim, err: string) => {
    FAIL_RUN.run(err, c.runId);
    if (c.attempt + 1 >= config.maxAttempts) BLOCK_ACTION.run(c.actionId);
    else REQUEUE_ACTION.run(c.actionId);
    UNLOCK_COMPANY.run(c.companyId, c.runId);
});

// Green run → the gate. `auto` (autopilot + reversible) skips straight to `approved`; the
// company lock is deliberately NOT released here - the ship driver holds it through promote.
const finishAwait = sqlite.transaction((c: Claim, auto: boolean) => {
    AWAIT_RUN.run(c.runId);
    (auto ? AUTO_APPROVE_ACTION : AWAIT_ACTION).run(c.actionId);
});

function patchCheckpoint(runId: string, patch: Partial<Checkpoint>): void {
    const row = GET_CHECKPOINT.get(runId) as { checkpoint: string | null } | undefined;
    const cur: Checkpoint = row?.checkpoint ? JSON.parse(row.checkpoint) : {};
    SET_CHECKPOINT.run(JSON.stringify({ ...cur, ...patch }), runId);
}

function getPayload(actionId: string): { title: string; payload: CodePayload } | undefined {
    const a = GET_ACTION.get(actionId) as { title: string; payload: string } | undefined;
    if (!a) return undefined;
    let payload: CodePayload = { doneWhen: "http-signup" };
    try {
        payload = JSON.parse(a.payload) as CodePayload;
    } catch {
        /* payload not JSON - fall back to default */
    }
    return { title: a.title, payload };
}

// Persist the live preview URL onto the action payload so the UI (inbox / company detail)
// can link the running app while it sits in the approval gate. previewUrl is a first-class
// CodePayload field, so this is a schema-clean write.
function setPreviewUrl(actionId: string, url: string): void {
    const cur = getPayload(actionId);
    if (!cur) return;
    SET_PAYLOAD.run(JSON.stringify({ ...cur.payload, previewUrl: url }), actionId);
}

function shouldAutopilot(actionId: string): boolean {
    const g = GET_GATE.get(actionId) as
        | { autopilot: string; reversible: number; type: string }
        | undefined;
    return !!g && g.autopilot === "on" && g.type === "code" && !!g.reversible;
}

const SYSTEM_PROMPT = loadSystemPrompt();
function loadSystemPrompt(): string {
    try {
        return readFileSync(join(process.cwd(), "prompts", "harness-system.md"), "utf8");
    } catch {
        return "";
    }
}

function buildPrompt(actionId: string): string {
    const a = getPayload(actionId);
    if (!a) return "Ship the walking-skeleton feature described in AGENTS.md.";
    const feedback = (a.payload as { feedback?: string }).feedback;
    return [
        "Build this feature for the app in the current working directory:",
        "",
        a.title,
        "",
        a.payload.doneWhen ? `Acceptance (doneWhen): ${a.payload.doneWhen}` : "",
        feedback ? `\nReviewer feedback from the last attempt (address it): ${feedback}` : "",
        "",
        "Read AGENTS.md and slop/ first. Follow the system contract exactly. Ship the thinnest",
        "working version that satisfies the acceptance check, then stop.",
    ]
        .filter((l) => l !== "")
        .join("\n");
}

// The follow-up prompt for an iterate-to-green retry: the same session already built the
// app, so a terse "here's exactly what the distinct check found - fix it" is enough.
function iterationPrompt(detail: string): string {
    return [
        "The app you built is deployed but FAILED the acceptance check:",
        "",
        detail,
        "",
        "Fix the code in the working directory so the check passes. Keep it minimal, then stop.",
    ].join("\n");
}

export async function runOne(ctx: EngineContext, claim: Claim): Promise<void> {
    const log = new RunLog(claim.runId);
    const ac = new AbortController();
    const wall = setTimeout(() => ac.abort(), config.wallClockMs);
    const harness = ctx.resolveHarness();
    const real = harness.kind !== "noop";
    log.write({
        type: "status",
        msg: `run started (action ${claim.actionId}, attempt ${claim.attempt})`,
    });

    try {
        // Real harness builds inside the company's git worktree; the NO-OP runs in place.
        // prepareRun cuts a fresh run branch from a CLEAN main, so the agent never inherits a
        // prior/failed run's files (also covers in-session retry cleanup the boot reaper can't).
        let workdir = process.cwd();
        if (real) {
            const repo = await ctx.git.ensureRepo(claim.companyId);
            workdir = repo.workdir;
            // Stop any previously-shipped app for this company BEFORE prepareRun mutates their
            // shared working tree - otherwise it would serve out of a half-reset/cleaned tree.
            // (down() is idempotent.) A later up() re-serves the newly-built slice.
            await ctx.deploy.down(claim.companyId).catch(() => {});
            await ctx.git.prepareRun(workdir, claim.runId);
        }

        // Harness IO shared by the noop call and every iterate-to-green retry.
        const io: HarnessIO = {
            onLine: (msg, stream) => log.write({ type: "log", stream, msg }),
            // only persist a real pgid - a failed spawn reports -1, which must never reach the reaper
            onSpawn: ({ pgid }) => {
                if (pgid > 0) patchCheckpoint(claim.runId, { agentPgid: pgid });
            },
            signal: ac.signal,
        };

        // NO-OP path: one call, no deploy/validate - keeps the original control-plane behavior
        // (proves claim → run → log → done without spending tokens).
        if (!real) {
            const res = await harness.run(
                {
                    runId: claim.runId,
                    workdir,
                    prompt: "",
                    systemPrompt: "",
                    maxTurns: MAX_TURNS,
                    wallClockMs: config.wallClockMs,
                    env: {},
                },
                io,
            );
            if (res.costUsd > 0) SET_COST.run(res.costUsd, claim.runId);
            if (!res.ok) throw new Error("harness reported failure / aborted");
            finishSucceed.immediate(claim);
            log.write({ type: "end", status: "succeeded" });
            return;
        }

        // ── iterate-to-green ────────────────────────────────────────────────────────
        // build → deploy → validate; a RED doneWhen is fed back into the SAME session to
        // fix (resume), then redeploy + re-validate, up to maxBuildIters. Only a green check
        // leaves the loop; exhausting the budget fails the run (requeue/block). prepareRun
        // cleaned the worktree ONCE above, so each retry edits its own prior code, not a
        // blank slate. This in-run repair loop is the main cold-run pass-rate lever.
        // v1 has one validator archetype; every doneWhen maps to it.
        const kind = "http-signup" as const;
        let totalCost = 0;
        let sessionId: string | undefined;
        let lastDetail = "";
        let green = false;

        for (let iter = 1; iter <= config.maxBuildIters; iter++) {
            if (ac.signal.aborted) throw new Error("aborted (wall clock)");
            log.write({ type: "status", msg: `build attempt ${iter}/${config.maxBuildIters}` });

            const res = await harness.run(
                {
                    runId: claim.runId,
                    workdir,
                    prompt: iter === 1 ? buildPrompt(claim.actionId) : iterationPrompt(lastDetail),
                    systemPrompt: SYSTEM_PROMPT,
                    sessionId, // undefined on turn 1 (new session); set on retries (resume)
                    maxTurns: MAX_TURNS,
                    wallClockMs: config.wallClockMs,
                    env: {},
                },
                io,
            );
            // KNOWN GAP (apikey mode only): a wall-clock SIGKILL abort kills claude before its
            // final result event, so costUsd is 0 and that spend goes un-metered. Fix when
            // metering matters = accumulate per-message usage. Subscription mode reports ~$0.
            totalCost += res.costUsd;
            if (totalCost > 0) SET_COST.run(totalCost, claim.runId);
            if (!res.ok) throw new Error("harness reported failure / aborted");
            sessionId = res.sessionId;

            // deploy this iteration's build on a real local URL
            log.write({ type: "status", msg: "deploying build to a local URL…" });
            const dep = await ctx.deploy.up({
                companyId: claim.companyId,
                runId: claim.runId,
                workdir,
                startCmd: "node server.js",
                healthPath: "/",
            });
            patchCheckpoint(claim.runId, { deployPgid: dep.pgid });
            setPreviewUrl(claim.actionId, dep.url);
            log.write({ type: "status", msg: `deployed → ${dep.url}` });

            // DISTINCT validation against the live URL (the builder never self-certifies)
            log.write({ type: "status", msg: "validating doneWhen against the live URL…" });
            const verdict = await ctx.validator.check({ url: dep.url, kind });
            if (verdict.green) {
                green = true;
                log.write({ type: "status", msg: `doneWhen GREEN · ${verdict.detail}` });
                break; // keep this deploy UP for preview/ship
            }
            lastDetail = verdict.detail;
            await ctx.deploy.down(claim.companyId); // free the port before rebuilding
            const more = iter < config.maxBuildIters;
            log.write({
                type: "status",
                msg: `doneWhen RED · ${verdict.detail}${more ? " - feeding back, rebuilding" : ""}`,
            });
        }

        if (!green) {
            throw new Error(
                `validation red after ${config.maxBuildIters} build attempts: ${lastDetail}`,
            );
        }

        // ── checkpoint the GREEN build on the run branch ────────────────────────────
        const sha = await ctx.git.commitAll(
            workdir,
            claim.runId,
            `feat: build action ${claim.actionId}`,
        );
        patchCheckpoint(claim.runId, { gitSha: sha, sessionId });
        log.write({ type: "status", msg: `checkpoint ${sha.slice(0, 8)}` });

        // ── approval gate (step 7): rest at awaiting_approval, or auto-approve under autopilot ──
        // The ship driver (loop) promotes it → done and writes the terminal log line, so ONE
        // run log tells the whole story: build (×N) → deploy → validate → (approve) → ship.
        const auto = shouldAutopilot(claim.actionId);
        finishAwait.immediate(claim, auto);
        log.write({
            type: "status",
            msg: auto
                ? "green + reversible → auto-approved (autopilot); shipping…"
                : "green - awaiting your approval to ship",
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Tear down any preview this run brought up, so a failed/aborted run never leaks a
        // live server holding its port (down() is idempotent - no-op if nothing was deployed).
        await ctx.deploy.down(claim.companyId).catch(() => {});
        finishFail.immediate(claim, msg);
        log.write({ type: "end", status: "failed", error: msg });
    } finally {
        clearTimeout(wall);
    }
}
