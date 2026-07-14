import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AI so the spin passes never spawn claude. Default rejects → deterministic fallback.
vi.mock("./dispatch.js", () => ({
    dispatchAI: vi.fn(async () => {
        throw new Error("no ai in tests");
    }),
}));

import { SCORE_KEYS } from "../config/spin.js";
import { sqlite } from "../db/index.js";
import { dispatchAI } from "./dispatch.js";
import { spinScout, spinSpec } from "./spin.js";

const mockAI = vi.mocked(dispatchAI);

function clearAll() {
    sqlite.exec("DELETE FROM draft; DELETE FROM company;");
}

type DraftInit = { thought?: string; status?: string; data?: unknown; preset?: string };
function makeDraft(init: DraftInit = {}): string {
    const id = randomUUID();
    sqlite
        .prepare("INSERT INTO draft (id,thought,status,guardrails,data) VALUES (?,?,?,?,?)")
        .run(
            id,
            init.thought ?? "a scheduling tool for tutors",
            init.status ?? "scouting",
            JSON.stringify({ preset: init.preset ?? "balanced" }),
            JSON.stringify(init.data ?? {}),
        );
    return id;
}

function read(id: string): { status: string; data: Record<string, unknown> } {
    const r = sqlite.prepare("SELECT status, data FROM draft WHERE id=?").get(id) as {
        status: string;
        data: string;
    };
    return { status: r.status, data: JSON.parse(r.data) };
}

const aiOk = (text: string) => ({ text, model: "x", via: "claude-cli" as const, costUsd: 0 });

beforeEach(() => {
    clearAll();
    mockAI.mockReset();
    mockAI.mockRejectedValue(new Error("no ai"));
});

describe("spinScout", () => {
    it("scouts a fresh draft via the fallback path: proposals + 3 fully-scored candidates", async () => {
        const id = makeDraft({ thought: "budgeting for freelancers" });
        await spinScout(new Set());
        const { status, data } = read(id);
        expect(status).toBe("proposals");
        const cands = data.candidates as Array<Record<string, unknown>>;
        expect(cands).toHaveLength(3);
        for (const c of cands) {
            expect(typeof c.id).toBe("string");
            expect(typeof c.name).toBe("string");
            const scores = c.scores as Record<string, number>;
            for (const k of SCORE_KEYS) expect(scores[k]).toBeGreaterThanOrEqual(0);
            expect((c.evidence as unknown[]).length).toBeGreaterThan(0);
            expect((c.firstSlice as { title: string }).title).toBeTruthy();
        }
    });

    it("uses real AI candidates when dispatch succeeds and ranks them best-first", async () => {
        const id = makeDraft();
        const strong = {
            name: "Strong Bet",
            icp: "x",
            wedge: "w",
            pain: "p",
            scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, 9])),
            evidence: [{ kind: "demand", text: "lots asked", source: "forum" }],
            firstSlice: { title: "signup", doneWhen: "live" },
        };
        const weak = {
            ...strong,
            name: "Weak Bet",
            scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, 2])),
        };
        mockAI.mockResolvedValueOnce(aiOk(JSON.stringify([weak, strong])));
        await spinScout(new Set());
        const { status, data } = read(id);
        expect(status).toBe("proposals");
        const cands = data.candidates as Array<{ name: string }>;
        expect(cands.map((c) => c.name)).toEqual(["Strong Bet", "Weak Bet"]); // ranked
    });

    it("is status-gated — a second scout is a no-op (draft already 'proposals')", async () => {
        const id = makeDraft();
        await spinScout(new Set());
        const first = read(id).data.candidates;
        await spinScout(new Set());
        expect(read(id).data.candidates).toEqual(first);
    });

    it("skips a draft in the in-flight set", async () => {
        const id = makeDraft();
        await spinScout(new Set([id]));
        expect(read(id).status).toBe("scouting"); // untouched
    });

    it("only scouts 'scouting' drafts (ignores other statuses)", async () => {
        const id = makeDraft({ status: "spec" });
        await spinScout(new Set());
        expect(read(id).status).toBe("spec");
    });
});

describe("spinSpec", () => {
    const oneCandidate = (candId: string) => ({
        candidates: [
            {
                id: candId,
                name: "Auto-Nudge",
                icp: "solo founders",
                wedge: "nudges at the right time",
                pain: "leads go cold",
                scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, 7])),
                evidence: [{ kind: "demand", text: "asked often", source: "forum" }],
                firstSlice: { title: "signup", doneWhen: "live" },
            },
        ],
        pickedId: candId,
    });

    it("specs the picked candidate via the fallback path: spec + branding, status 'spec'", async () => {
        const candId = randomUUID();
        const id = makeDraft({ status: "specing", data: oneCandidate(candId) });
        await spinSpec(new Set());
        const { status, data } = read(id);
        expect(status).toBe("spec");
        const spec = data.spec as Record<string, unknown>;
        expect(typeof spec.product).toBe("string");
        expect(spec.pricingUsd).toBeGreaterThan(0);
        expect((spec.slices as unknown[]).length).toBeGreaterThan(0);
        const branding = data.branding as Record<string, unknown>;
        expect((branding.mark as string).length).toBe(1);
        expect(branding.palette as string[]).toHaveLength(2);
    });

    it("uses real AI spec + branding when dispatch succeeds", async () => {
        const candId = randomUUID();
        const id = makeDraft({ status: "specing", data: oneCandidate(candId) });
        mockAI.mockResolvedValueOnce(
            aiOk(
                JSON.stringify({
                    product: "NudgePay",
                    tagline: "close leads on autopilot",
                    icp: "founders",
                    pricingUsd: 49,
                    trialDays: 14,
                    stack: ["TanStack", "SQLite"],
                    slices: [{ title: "signup", sub: "live page", doneWhen: "accepts email" }],
                    market: {
                        persona: "founder",
                        mrrLow: 1000,
                        mrrHigh: 5000,
                        wtpQuote: "shut up and take my money",
                        competitors: [{ name: "Rival", price: "$99", weakness: "slow" }],
                    },
                    branding: {
                        mark: "N",
                        palette: ["#e0794c", "#c05a2f"],
                        domain: "nudgepay.app",
                        style: "bold",
                    },
                }),
            ),
        );
        await spinSpec(new Set());
        const { status, data } = read(id);
        expect(status).toBe("spec");
        expect((data.spec as { product: string }).product).toBe("NudgePay");
        expect((data.spec as { pricingUsd: number }).pricingUsd).toBe(49);
        expect((data.branding as { domain: string }).domain).toBe("nudgepay.app");
    });

    it("fails a 'specing' draft that has no candidates (pick lost)", async () => {
        const id = makeDraft({ status: "specing", data: {} });
        await spinSpec(new Set());
        expect(read(id).status).toBe("failed");
    });

    it("only specs 'specing' drafts (ignores 'scouting')", async () => {
        const id = makeDraft({ status: "scouting" });
        await spinSpec(new Set());
        expect(read(id).status).toBe("scouting");
    });

    it("discards a stale spec when the pick changed mid-flight (re-pick race)", async () => {
        // spinSpec starts drafting for pick A; while the AI runs, the founder re-picks B (a
        // concurrent web write). The pickedId guard must drop A's now-stale spec, not overwrite B.
        const candA = randomUUID();
        const id = makeDraft({ status: "specing", data: oneCandidate(candA) });
        // The AI "resolving" is when the concurrent re-pick lands: flip pickedId to a new value
        // (still 'specing') right before returning a spec for A.
        mockAI.mockImplementationOnce(async () => {
            sqlite
                .prepare("UPDATE draft SET data=? WHERE id=?")
                .run(JSON.stringify({ ...oneCandidate(randomUUID()) }), id);
            return aiOk(JSON.stringify({ product: "StaleSpecForA", pricingUsd: 20, trialDays: 7 }));
        });
        await spinSpec(new Set());
        const after = read(id);
        // guard bailed: still awaiting a spec for the CURRENT pick, no stale spec written.
        expect(after.status).toBe("specing");
        expect(after.data.spec).toBeUndefined();
    });
});
