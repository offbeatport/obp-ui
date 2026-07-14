import { closeSync, openSync, readSync, statSync } from "node:fs";
import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
import { companies, db, runs } from "~/db";
import { type LogLine, logPath } from "~/engine/log";
import { type Tone, listActivity, listCompanies } from "./data";

// ============================================================================
// AGENT CONSOLE — the bottom-docked "one agent per company, live" panel from
// design/v2-prototypes/08-chat-spine-pro-v7.html (AGENT CONSOLE section).
//
// EFFICIENCY: the console is a *glanceable* overview, not a byte-exact tail. The
// client POLLS this ONE digest endpoint (adaptive 0.75s active / 4s idle) with a
// per-pane cursor; we return only the delta lines since that cursor. That beats
// N per-run SSE tails (N held connections + whole-file polling + no shared FS on
// hosted). The full-fidelity per-run tail stays on the company page.
//
// SEAM: getDigestSnapshot() is a per-tenant COALESCING CACHE (~500ms) so many
// tabs/polls collapse to one DB query + file read. Local reads the executor's
// `.runs/<id>/log.ndjson` directly; a hosted DigestSource (remote executors, no
// shared FS) swaps in behind this same function — see the `hosted` note below.
// ============================================================================

export type ConsoleKind = "act" | "ok" | "warn" | "info" | "msg";
export type ConsolePaneState = "building" | "awaiting_approval" | "shipped" | "blocked" | "todo";

// `off` = absolute byte offset (end) of the line in its run log — the pane cursor.
// Fallback (activity) lines use small monotonic offsets; both are per-pane consistent.
export type ConsoleLine = { off: number; t: number; kind: ConsoleKind; msg: string };

export type ConsolePane = {
    slug: string;
    name: string;
    tone: Tone;
    state: ConsolePaneState;
    active: boolean; // a run is live (or building) — drives the adaptive poll interval
    cursor: number; // latest offset the client should send back next poll
    lines: ConsoleLine[]; // DELTA since the client's cursor (full window on first poll)
};

export type ConsoleDigest = { panes: ConsolePane[]; anyActive: boolean };

// ---- log line → console kind/text --------------------------------------------
function parseLine(seg: string, off: number): ConsoleLine | null {
    let rec: LogLine;
    try {
        rec = JSON.parse(seg) as LogLine;
    } catch {
        return null; // non-JSON / partial line
    }
    if (rec.type === "status") return { off, t: rec.t, kind: "info", msg: rec.msg };
    if (rec.type === "log")
        return { off, t: rec.t, kind: rec.stream === "stderr" ? "warn" : "msg", msg: rec.msg };
    // type === "end"
    const ok = rec.status === "succeeded";
    return {
        off,
        t: rec.t,
        kind: ok ? "ok" : "warn",
        msg: `● ${rec.status}${rec.error ? `: ${rec.error}` : ""}`,
    };
}

// Read only the last ~8KB of a run log and parse whole lines with absolute byte
// offsets. Never reads the whole file. Drops a leading partial line when we start
// mid-file, and a trailing partial line is simply not terminated by \n so it's skipped.
const TAIL_BYTES = 8192;
function tailLog(runId: string): { lines: ConsoleLine[]; size: number } {
    let fd: number | undefined;
    try {
        const size = statSync(logPath(runId)).size;
        const start = Math.max(0, size - TAIL_BYTES);
        const len = size - start;
        if (len <= 0) return { lines: [], size };
        const buf = Buffer.alloc(len);
        fd = openSync(logPath(runId), "r");
        readSync(fd, buf, 0, len, start);
        const lines: ConsoleLine[] = [];
        // skip a partial first line when we didn't start at byte 0
        let lineStart = 0;
        if (start > 0) {
            const nl = buf.indexOf(0x0a);
            lineStart = nl < 0 ? len : nl + 1;
        }
        for (let i = lineStart; i < len; i++) {
            if (buf[i] === 0x0a) {
                const parsed = parseLine(buf.toString("utf8", lineStart, i), start + i + 1);
                if (parsed) lines.push(parsed);
                lineStart = i + 1;
            }
        }
        return { lines, size };
    } catch {
        return { lines: [], size: 0 }; // file not created yet, etc.
    } finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            } catch {
                /* already closed */
            }
        }
    }
}

const TONE_KIND: Record<Tone, ConsoleKind> = {
    green: "ok",
    blue: "info",
    violet: "info",
    slate: "msg",
    amber: "warn",
    red: "warn",
};

// ---- the coalescing snapshot (per tenant) ------------------------------------
type Snapshot = { at: number; panes: ConsolePane[]; anyActive: boolean };
const COALESCE_MS = 500;
const snapCache = new Map<string, Snapshot>();

async function buildSnapshot(): Promise<Snapshot> {
    const [cos, activity] = await Promise.all([listCompanies(), listActivity()]);

    // Latest run keyed by company NAME. `running` means genuinely live; an awaiting_approval
    // run is idle (waiting on a human) — we still show its log tail but it must NOT count as
    // "working" (no pulse, and it doesn't force the fast poll interval).
    const active = new Map<string, { runId: string; running: boolean }>(); // name -> run
    try {
        const rows = db
            .select({ runId: runs.id, name: companies.name, status: runs.status })
            .from(runs)
            .innerJoin(companies, eq(runs.companyId, companies.id))
            .where(inArray(runs.status, ["running", "awaiting_approval"]))
            .all();
        for (const r of rows)
            if (r.name) active.set(r.name, { runId: r.runId, running: r.status === "running" });
    } catch {
        /* no runs yet — fall back to activity lines below */
    }

    const panes: ConsolePane[] = cos.map((co) => {
        const run = active.get(co.name);
        const state: ConsolePaneState = co.slice?.state ?? "todo";
        if (run) {
            const { lines, size } = tailLog(run.runId);
            return {
                slug: co.slug,
                name: co.name,
                tone: co.tone,
                state,
                active: run.running,
                cursor: size,
                lines,
            };
        }
        // idle pane: seed with this company's recent activity, then go quiet (cursor caps it)
        const seed = activity
            .filter((a) => a.companySlug === co.slug)
            .slice(0, 8)
            .map<ConsoleLine>((a, i) => ({
                off: i + 1,
                t: Date.now(),
                kind: TONE_KIND[a.tone],
                msg: a.text,
            }));
        return {
            slug: co.slug,
            name: co.name,
            tone: co.tone,
            state,
            active: state === "building",
            cursor: seed.length,
            lines: seed,
        };
    });

    return { at: Date.now(), panes, anyActive: panes.some((p) => p.active) };
}

async function getDigestSnapshot(tenant = "global"): Promise<Snapshot> {
    const hit = snapCache.get(tenant);
    if (hit && Date.now() - hit.at < COALESCE_MS) return hit;
    const snap = await buildSnapshot();
    snapCache.set(tenant, snap);
    return snap;
}

// ---- the one read the console polls ------------------------------------------
export const getConsoleDigest = createServerFn({ method: "GET" })
    .validator((d: { cursors?: Record<string, number> } | undefined) => d ?? {})
    .handler(async ({ data }): Promise<ConsoleDigest> => {
        const snap = await getDigestSnapshot();
        const cursors = data.cursors ?? {};
        const panes = snap.panes.map((p) => ({
            ...p,
            lines: p.lines.filter((l) => l.off > (cursors[p.slug] ?? 0)),
        }));
        return { panes, anyActive: snap.anyActive };
    });
