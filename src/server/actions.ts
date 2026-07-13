import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray } from "drizzle-orm";
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

// Dev convenience: clear the queue and unlock companies so the spine can be re-run.
export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
    db.delete(runs).run(); // runs FK-reference actions, so delete them first
    db.delete(actions).run();
    db.update(companies).set({ lockedByRunId: null }).run();
    return { ok: true };
});
