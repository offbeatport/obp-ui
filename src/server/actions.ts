import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { actions, companies, db, runs } from "../db/index.js";

// Web-side server functions. Deliberately WRITE-MINIMAL - every handler does tiny DB
// writes only, never subprocess/agent work. That keeps the synchronous better-sqlite3
// busy-wait from ever stalling the HTTP/SSR loop under cross-process contention.

const DEMO_NAME = "Demo Co";

// Enqueue the hardcoded spine action: "a visitor can sign up on a live URL".
// Creates the demo company on first use.
export const enqueueDemo = createServerFn({ method: "POST" }).handler(async () => {
    let company = db.select().from(companies).where(eq(companies.name, DEMO_NAME)).get();
    if (!company) {
        company = db
            .insert(companies)
            .values({
                name: DEMO_NAME,
                thesis: "Spine demo company - proves the run-executor end to end.",
            })
            .returning()
            .get();
    }
    // Demo company runs on autopilot so the spine ships fully autonomously: a reversible
    // `code` action auto-approves on a green doneWhen (the L1 rule) — no human click needed
    // to see one run go thought → built → deployed → validated → shipped end to end.
    db.update(companies).set({ autopilot: "on" }).where(eq(companies.id, company.id)).run();
    const action = db
        .insert(actions)
        .values({
            companyId: company.id,
            type: "code",
            title: "A visitor can sign up on a live URL",
            reversible: true,
            status: "queued",
            priority: 1,
            payload: { doneWhen: "http-signup" },
        })
        .returning()
        .get();
    return { actionId: action.id, companyId: company.id };
});

// L0 approval gate — you approve a green action; the executor's ship driver then promotes
// its checkpoint sha to main and flips it done. Guarded to the resting state so a stray
// double-click (or an autopilot race) is a harmless no-op.
export const approveAction = createServerFn({ method: "POST" })
    .validator((actionId: string) => actionId)
    .handler(async ({ data: actionId }) => {
        const changed = db
            .update(actions)
            .set({ status: "approved" })
            .where(and(eq(actions.id, actionId), eq(actions.status, "awaiting_approval")))
            .run();
        return { ok: changed.changes === 1 };
    });

// Reject-with-feedback: the awaiting run is failed and the action re-queued as a new attempt
// with the note attached (buildPrompt threads it into the next build), and the company lock
// released so the loop can re-pull it. Tears down the preview deploy via its recorded pgid.
export const rejectAction = createServerFn({ method: "POST" })
    .validator((d: { actionId: string; feedback?: string }) => d)
    .handler(async ({ data }) => {
        const action = db.select().from(actions).where(eq(actions.id, data.actionId)).get();
        if (!action || action.status !== "awaiting_approval") return { ok: false };
        const run = db
            .select()
            .from(runs)
            .where(and(eq(runs.actionId, data.actionId), eq(runs.status, "awaiting_approval")))
            .orderBy(desc(runs.createdAt))
            .get();
        if (run) {
            const pgid = run.checkpoint?.deployPgid;
            if (pgid && pgid > 0) {
                try {
                    process.kill(-pgid, "SIGKILL");
                } catch {
                    /* already gone */
                }
            }
            db.update(runs)
                .set({ status: "failed", error: "rejected" })
                .where(eq(runs.id, run.id))
                .run();
        }
        const payload = { ...action.payload, feedback: data.feedback ?? "" };
        db.update(actions)
            .set({ status: "queued", payload })
            .where(eq(actions.id, data.actionId))
            .run();
        db.update(companies)
            .set({ lockedByRunId: null })
            .where(eq(companies.id, action.companyId))
            .run();
        return { ok: true };
    });

// One read for the whole Action Queue UI (polled). Mapped to plain primitives so the
// payload is trivially serializable over the server-fn wire (no json/unknown columns).
export const listQueue = createServerFn({ method: "GET" }).handler(async () => {
    const acts = db.select().from(actions).orderBy(desc(actions.priority), actions.createdAt).all();
    const liveRuns = db
        .select()
        .from(runs)
        .where(inArray(runs.status, ["queued", "running", "awaiting_approval"]))
        .orderBy(desc(runs.createdAt))
        .all();
    const comps = db.select().from(companies).all();
    return {
        actions: acts.map((a) => ({
            id: a.id,
            companyId: a.companyId,
            type: a.type,
            title: a.title,
            status: a.status,
            priority: a.priority,
        })),
        runs: liveRuns.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            status: r.status,
            attempt: r.attempt,
        })),
        companies: comps.map((c) => ({ id: c.id, name: c.name })),
    };
});

// Dev convenience: clear the queue and unlock companies so the spine can be re-run. Also
// kills any live deploy/agent process groups the runs left behind, so re-running the demo
// doesn't leak an orphaned app holding its port.
export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
    for (const r of db.select().from(runs).all()) {
        for (const pgid of [r.checkpoint?.deployPgid, r.checkpoint?.agentPgid]) {
            if (pgid && pgid > 0) {
                try {
                    process.kill(-pgid, "SIGKILL");
                } catch {
                    /* already gone */
                }
            }
        }
    }
    db.delete(runs).run(); // runs FK-reference actions, so delete them first
    db.delete(actions).run();
    db.update(companies).set({ lockedByRunId: null }).run();
    return { ok: true };
});
