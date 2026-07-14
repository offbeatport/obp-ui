import { beforeEach, describe, expect, it, vi } from "vitest";

// Force the deterministic fallback path (no claude spawn) for the whole spin lifecycle.
vi.mock("./dispatch.js", () => ({
    dispatchAI: vi.fn(async () => {
        throw new Error("no ai in e2e");
    }),
}));

import { sqlite } from "../db/index.js";
import { commitDraftLogic, pickOpportunityLogic, startSpinLogic } from "../server/spin-logic.js";
import { spinScout, spinSpec } from "./spin.js";

// The web fns (createServerFn) are thin shells over these logic fns + getDraft; they need the
// Start request runtime, so the e2e drives the logic layer directly (same DB writes) plus a
// tiny inline getDraft-equivalent read.
function readDraft(id: string) {
    const r = sqlite.prepare("SELECT status, data, company_id FROM draft WHERE id=?").get(id) as
        | { status: string; data: string; company_id: string | null }
        | undefined;
    if (!r) return undefined;
    const data = JSON.parse(r.data) as {
        candidates?: { id: string }[];
        spec?: { product: string };
        branding?: { domain: string };
    };
    return { status: r.status, companyId: r.company_id, ...data };
}

function clearAll() {
    sqlite.exec(
        "DELETE FROM run; DELETE FROM action; DELETE FROM message; DELETE FROM opportunity; DELETE FROM draft; DELETE FROM company; DELETE FROM app_config;",
    );
}
const count = (sql: string, ...p: unknown[]) => (sqlite.prepare(sql).get(...p) as { n: number }).n;

beforeEach(clearAll);

// Drives the WHOLE flow through the real web fns + engine passes: startSpin → spinScout →
// pickOpportunity → spinSpec → commitDraft, then asserts the company is created already-scoped
// (opportunity + first http-signup action + scope marker) so the runner builds and scope skips.
describe("spin end-to-end (web fns + engine passes, fallback AI)", () => {
    it("thought → scouted candidates → pick → spec → committed company", async () => {
        // 1. start — a draft in 'scouting'
        const { id } = startSpinLogic("help freelancers get paid on time", "lean");
        expect(readDraft(id)?.status).toBe("scouting");

        // 2. engine scouts → 3 candidates, 'proposals'
        await spinScout(new Set());
        const proposed = readDraft(id);
        expect(proposed?.status).toBe("proposals");
        expect(proposed?.candidates).toHaveLength(3);

        // 3. pick the top candidate → 'specing'
        const candidateId = proposed?.candidates?.[0]?.id ?? "";
        expect(candidateId).toBeTruthy();
        expect(pickOpportunityLogic(id, candidateId).ok).toBe(true);
        expect(readDraft(id)?.status).toBe("specing");

        // 4. engine drafts the spec + branding → 'spec'
        await spinSpec(new Set());
        const specced = readDraft(id);
        expect(specced?.status).toBe("spec");
        expect(specced?.spec?.product).toBeTruthy();
        expect(specced?.branding?.domain).toBeTruthy();
        const product = specced?.spec?.product ?? "";

        // 5. commit → a real company, already scoped
        const res = commitDraftLogic(id);
        expect(res.ok).toBe(true);
        const companyId = res.id ?? "";
        expect(companyId).toBeTruthy();

        // draft is terminal + linked
        const done = readDraft(id);
        expect(done?.status).toBe("committed");
        expect(done?.companyId).toBe(companyId);

        // company carries the AI name; exactly one queued http-signup code action
        const company = sqlite
            .prepare("SELECT name, autopilot, domain FROM company WHERE id=?")
            .get(companyId) as { name: string; autopilot: string; domain: string | null };
        expect(company.name).toBe(product.slice(0, 48));
        expect(company.autopilot).toBe("on");

        const action = sqlite
            .prepare("SELECT type, status, payload FROM action WHERE company_id=?")
            .get(companyId) as { type: string; status: string; payload: string };
        expect(action.type).toBe("code");
        expect(action.status).toBe("queued");
        expect(JSON.parse(action.payload).doneWhen).toBe("http-signup");

        // promoted opportunity + scope marker (so scope.ts skips this company)
        expect(count("SELECT COUNT(*) n FROM opportunity WHERE status='promoted'")).toBe(1);
        expect(
            count("SELECT COUNT(*) n FROM app_config WHERE key=?", `scope.done.${companyId}`),
        ).toBe(1);
        // founding narration (2 assistant turns)
        expect(count("SELECT COUNT(*) n FROM message WHERE company_id=?", companyId)).toBe(2);
    });

    it("commitDraft is idempotent — a second commit returns the same company, makes no dupes", async () => {
        const { id } = startSpinLogic("schedule tutors", "lean");
        await spinScout(new Set());
        const c = readDraft(id)?.candidates?.[0]?.id ?? "";
        pickOpportunityLogic(id, c);
        await spinSpec(new Set());
        const first = commitDraftLogic(id);
        const second = commitDraftLogic(id);
        expect(second.id).toBe(first.id);
        expect(count("SELECT COUNT(*) n FROM company")).toBe(1);
        expect(count("SELECT COUNT(*) n FROM action")).toBe(1);
    });

    it("guards the order: can't pick before proposals, can't commit before spec", async () => {
        const { id } = startSpinLogic("x", "lean");
        // still 'scouting' — pick + commit are no-ops
        expect(pickOpportunityLogic(id, "nope").ok).toBe(false);
        expect(commitDraftLogic(id).ok).toBe(false);
        expect(count("SELECT COUNT(*) n FROM company")).toBe(0);
    });
});
