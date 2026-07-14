import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AI so scopeNext never spawns claude. Default rejects → deterministic fallback path.
vi.mock("./dispatch.js", () => ({
    dispatchAI: vi.fn(async () => {
        throw new Error("no ai in tests");
    }),
}));

import { sqlite } from "../db/index.js";
import { dispatchAI } from "./dispatch.js";
import { extractJson, scopeNext } from "./scope.js";

const mockAI = vi.mocked(dispatchAI);

function clearAll() {
    sqlite.exec(
        "DELETE FROM run; DELETE FROM action; DELETE FROM message; DELETE FROM opportunity; DELETE FROM company; DELETE FROM app_config;",
    );
}
function makeCompany(thesis = "a thought worth building", status = "active"): string {
    const id = randomUUID();
    sqlite
        .prepare("INSERT INTO company (id,name,thesis,status,autopilot) VALUES (?,?,?,?,'on')")
        .run(id, "Co", thesis, status);
    return id;
}
const n = (sql: string, ...p: unknown[]) => (sqlite.prepare(sql).get(...p) as { n: number }).n;
const actions = (cid: string) => n("SELECT COUNT(*) n FROM action WHERE company_id=?", cid);
const msgs = (cid: string) => n("SELECT COUNT(*) n FROM message WHERE company_id=?", cid);
const marked = (cid: string) =>
    !!sqlite
        .prepare("SELECT 1 FROM app_config WHERE scope='global' AND key=?")
        .get(`scope.done.${cid}`);

beforeEach(() => {
    clearAll();
    mockAI.mockReset();
    mockAI.mockRejectedValue(new Error("no ai"));
});

describe("extractJson", () => {
    it("parses bare JSON", () => expect(extractJson('{"a":1}')).toEqual({ a: 1 }));
    it("strips ``` code fences", () =>
        expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
    it("extracts JSON embedded in prose", () =>
        expect(extractJson('Sure! {"title":"X","score":5} — done')).toEqual({
            title: "X",
            score: 5,
        }));
    it("returns null on non-JSON", () => expect(extractJson("no json here")).toBeNull());
    it("returns null on truncated JSON", () => expect(extractJson('{"a":')).toBeNull());
});

describe("scopeNext", () => {
    it("scopes a fresh company via the fallback path: opportunity + 2 narration + 1 signup action + marker", async () => {
        const cid = makeCompany("A budgeting tool for freelancers");
        await scopeNext(new Set());
        expect(actions(cid)).toBe(1);
        expect(msgs(cid)).toBe(2);
        expect(marked(cid)).toBe(true);
        const act = sqlite
            .prepare("SELECT title, payload, status, reversible FROM action WHERE company_id=?")
            .get(cid) as { title: string; payload: string; status: string; reversible: number };
        expect(act.title).toBe("A visitor can sign up on a live URL");
        expect(JSON.parse(act.payload).doneWhen).toBe("http-signup");
        expect(act.status).toBe("queued");
        expect(act.reversible).toBe(1);
        const opp = sqlite.prepare("SELECT status FROM opportunity").get() as { status: string };
        expect(opp.status).toBe("promoted");
    });

    it("is idempotent — a second scopeNext does nothing", async () => {
        const cid = makeCompany();
        await scopeNext(new Set());
        await scopeNext(new Set());
        expect(actions(cid)).toBe(1);
        expect(msgs(cid)).toBe(2);
        expect(n("SELECT COUNT(*) n FROM opportunity")).toBe(1);
    });

    it("skips a company that already has an action (empty-queue precondition — no double-scope)", async () => {
        const cid = makeCompany();
        sqlite
            .prepare(
                "INSERT INTO action (id,company_id,type,title,reversible,status,priority,payload) VALUES (?,?,'code','existing',1,'queued',1,'{}')",
            )
            .run(randomUUID(), cid);
        await scopeNext(new Set());
        expect(actions(cid)).toBe(1); // unchanged — not scoped
        expect(marked(cid)).toBe(false);
    });

    it("skips a company that already carries a scope marker", async () => {
        const cid = makeCompany();
        sqlite
            .prepare("INSERT INTO app_config (scope,key,value) VALUES ('global',?, 'true')")
            .run(`scope.done.${cid}`);
        await scopeNext(new Set());
        expect(actions(cid)).toBe(0);
    });

    it("skips a company already in the in-flight set", async () => {
        const cid = makeCompany();
        await scopeNext(new Set([cid]));
        expect(actions(cid)).toBe(0);
    });

    it("does not scope a non-active company", async () => {
        const cid = makeCompany("paused idea", "paused");
        await scopeNext(new Set());
        expect(actions(cid)).toBe(0);
    });

    it("uses real AI output when dispatch succeeds", async () => {
        makeCompany("meeting summaries");
        mockAI
            .mockResolvedValueOnce({
                text: '{"title":"TaskThread","thesis":"meeting-to-actions","score":6}',
                model: "x",
                via: "claude-cli",
                costUsd: 0,
            })
            .mockResolvedValueOnce({
                text: "Build a signup page.",
                model: "x",
                via: "claude-cli",
                costUsd: 0,
            });
        await scopeNext(new Set());
        const opp = sqlite.prepare("SELECT title, score FROM opportunity").get() as {
            title: string;
            score: number;
        };
        expect(opp.title).toBe("TaskThread");
        expect(opp.score).toBe(6);
    });
});
