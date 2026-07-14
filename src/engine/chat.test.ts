import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./dispatch.js", () => ({ dispatchAI: vi.fn() }));

import { sqlite } from "../db/index.js";
import { answerNext } from "./chat.js";
import { dispatchAI } from "./dispatch.js";

const mockAI = vi.mocked(dispatchAI);

function clearAll() {
    sqlite.exec(
        "DELETE FROM message; DELETE FROM action; DELETE FROM company; DELETE FROM app_config;",
    );
}
function makeScopedCompany(): string {
    const id = randomUUID();
    sqlite
        .prepare(
            "INSERT INTO company (id,name,thesis,status,autopilot) VALUES (?,?,?,'active','on')",
        )
        .run(id, "Co", "a thesis");
    sqlite
        .prepare("INSERT INTO app_config (scope,key,value) VALUES ('global',?, 'true')")
        .run(`scope.done.${id}`);
    return id;
}
function addMsg(cid: string | null, role: string, content: string, createdAt: number) {
    sqlite
        .prepare("INSERT INTO message (id,company_id,role,content,created_at) VALUES (?,?,?,?,?)")
        .run(randomUUID(), cid, role, content, createdAt);
}
const assistantMsgs = (cid: string) =>
    sqlite
        .prepare(
            "SELECT content FROM message WHERE company_id=? AND role='assistant' ORDER BY created_at, rowid",
        )
        .all(cid) as { content: string }[];

beforeEach(() => {
    clearAll();
    mockAI.mockReset();
    mockAI.mockResolvedValue({
        text: "Here is my answer.",
        model: "x",
        via: "claude-cli",
        costUsd: 0,
    });
});

describe("answerNext", () => {
    it("answers an unanswered user turn in a scoped company", async () => {
        const cid = makeScopedCompany();
        addMsg(cid, "user", "what next?", 1000);
        await answerNext(new Set());
        expect(assistantMsgs(cid).map((m) => m.content)).toEqual(["Here is my answer."]);
    });

    it("always leaves a reply even when the AI errors (deterministic fallback, no spawn storm)", async () => {
        mockAI.mockRejectedValue(new Error("no ai"));
        const cid = makeScopedCompany();
        addMsg(cid, "user", "hello?", 1000);
        await answerNext(new Set());
        expect(assistantMsgs(cid)).toHaveLength(1); // a fallback reply was written
    });

    it("does NOT answer an unscoped company (no scope marker)", async () => {
        const id = randomUUID();
        sqlite
            .prepare(
                "INSERT INTO company (id,name,thesis,status,autopilot) VALUES (?,?,?,'active','on')",
            )
            .run(id, "Co", "t");
        addMsg(id, "user", "hi", 1000);
        await answerNext(new Set());
        expect(assistantMsgs(id)).toHaveLength(0);
    });

    it("ignores global chats (company_id IS NULL)", async () => {
        addMsg(null, "user", "how is my portfolio?", 1000);
        await answerNext(new Set());
        const global = sqlite
            .prepare("SELECT COUNT(*) n FROM message WHERE company_id IS NULL AND role='assistant'")
            .get() as { n: number };
        expect(global.n).toBe(0);
    });

    it("a system ship-notice does NOT suppress an unanswered user turn", async () => {
        const cid = makeScopedCompany();
        addMsg(cid, "user", "add pricing", 1000);
        addMsg(cid, "system", "Shipped: A visitor can sign up", 2000);
        await answerNext(new Set());
        expect(assistantMsgs(cid)).toHaveLength(1); // still answered despite the later system msg
    });

    it("does not re-answer a turn that already has an assistant reply", async () => {
        const cid = makeScopedCompany();
        addMsg(cid, "user", "q", 1000);
        addMsg(cid, "assistant", "prior answer", 2000);
        await answerNext(new Set());
        expect(assistantMsgs(cid)).toHaveLength(1); // unchanged — no duplicate
    });

    it("message-swallow fix: a follow-up sent before the first is answered is not dropped", async () => {
        const cid = makeScopedCompany();
        addMsg(cid, "user", "U1", 1000);
        addMsg(cid, "user", "U2", 2000); // arrived before either was answered
        await answerNext(new Set());
        // PICK targets the LAST user turn (U2) with the full transcript; exactly one reply,
        // and U1 is not falsely marked answered-by-proxy (it's covered by U2's context).
        expect(assistantMsgs(cid)).toHaveLength(1);
        // the reply sorts after U2, so the thread has no dangling unanswered latest-user turn
        const lastRole = (
            sqlite
                .prepare(
                    "SELECT role FROM message WHERE company_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
                )
                .get(cid) as { role: string }
        ).role;
        expect(lastRole).toBe("assistant");
    });

    it("skips a company already in the in-flight set (no head-of-line stall on others)", async () => {
        const a = makeScopedCompany();
        const b = makeScopedCompany();
        addMsg(a, "user", "qa", 1000);
        addMsg(b, "user", "qb", 1000);
        await answerNext(new Set([a])); // a is in flight → b gets answered this tick
        expect(assistantMsgs(a)).toHaveLength(0);
        expect(assistantMsgs(b)).toHaveLength(1);
    });
});
