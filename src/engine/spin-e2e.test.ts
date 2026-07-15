import { beforeEach, describe, expect, it, vi } from "vitest";

// Force the deterministic fallback path (no claude spawn) for the whole spin lifecycle.
vi.mock("./dispatch.js", () => ({
    dispatchAI: vi.fn(async () => {
        throw new Error("no ai in e2e");
    }),
}));

import { resolveGuardrails } from "../config/spin.js";
import { sqlite } from "../db/index.js";
import {
    continueWithoutResearchLogic,
    graduateCompany,
    pickOpportunityLogic,
    startSpinLogic,
} from "../server/spin-logic.js";
import { spinScout, spinSpec } from "./spin.js";

const LEAN = resolveGuardrails("lean");

// The web fns (createServerFn) are thin shells over these logic fns; they need the Start request
// runtime, so the e2e drives the logic layer directly (same DB writes) plus a tiny company read.
function readDraft(id: string) {
    const r = sqlite
        .prepare("SELECT status, spin_status AS spinStatus, spin FROM company WHERE id=?")
        .get(id) as { status: string; spinStatus: string | null; spin: string | null } | undefined;
    if (!r) return undefined;
    const spin = JSON.parse(r.spin ?? "{}") as {
        candidates?: { id: string }[];
        spec?: { product: string };
        branding?: { domain: string };
    };
    return { status: r.status, spinStatus: r.spinStatus, ...spin };
}

function clearAll() {
    sqlite.exec(
        "DELETE FROM run; DELETE FROM action; DELETE FROM message; DELETE FROM opportunity; DELETE FROM company; DELETE FROM app_config;",
    );
}
const count = (sql: string, ...p: unknown[]) => (sqlite.prepare(sql).get(...p) as { n: number }).n;

beforeEach(clearAll);

// Drives the WHOLE flow through the real logic fns + engine passes: startSpin creates a DRAFT
// company → spinScout → pick → spinSpec → approve (graduate), then asserts the SAME company row
// flips to active + already-scoped (opportunity + first http-signup action + scope marker).
describe("spin end-to-end (logic fns + engine passes, fallback AI)", () => {
    it("thought → draft company → scout → pick → spec → graduated active company", async () => {
        // 1. spin up - a draft company at spinStatus 'scouting'
        const { id } = startSpinLogic("help freelancers get paid on time", LEAN);
        expect(readDraft(id)?.status).toBe("draft");
        expect(readDraft(id)?.spinStatus).toBe("scouting");

        // 2. engine scouts → 3 candidates, 'proposals'
        await spinScout(new Set());
        const proposed = readDraft(id);
        expect(proposed?.spinStatus).toBe("proposals");
        expect(proposed?.candidates).toHaveLength(5);

        // 3. pick the top candidate → 'specing'
        const candidateId = proposed?.candidates?.[0]?.id ?? "";
        expect(candidateId).toBeTruthy();
        expect(pickOpportunityLogic(id, candidateId).ok).toBe(true);
        expect(readDraft(id)?.spinStatus).toBe("specing");

        // 4. engine drafts the spec + branding → 'spec'
        await spinSpec(new Set());
        const specced = readDraft(id);
        expect(specced?.spinStatus).toBe("spec");
        expect(specced?.spec?.product).toBeTruthy();
        expect(specced?.branding?.domain).toBeTruthy();
        const product = specced?.spec?.product ?? "";

        // 5. approve → the SAME company graduates to active + scoped
        const res = graduateCompany(id);
        expect(res.ok).toBe(true);
        expect(res.id).toBe(id);

        const company = sqlite
            .prepare(
                "SELECT name, status, spin_status AS spinStatus, autopilot, domain FROM company WHERE id=?",
            )
            .get(id) as {
            name: string;
            status: string;
            spinStatus: string | null;
            autopilot: string;
            domain: string | null;
        };
        expect(company.status).toBe("active");
        expect(company.spinStatus).toBeNull();
        expect(company.name).toBe(product.slice(0, 48));
        expect(company.autopilot).toBe("on");

        const action = sqlite
            .prepare("SELECT type, status, payload FROM action WHERE company_id=?")
            .get(id) as { type: string; status: string; payload: string };
        expect(action.type).toBe("code");
        expect(action.status).toBe("queued");
        expect(JSON.parse(action.payload).doneWhen).toBe("http-signup");

        // promoted opportunity + scope marker (so scope.ts skips this company)
        expect(count("SELECT COUNT(*) n FROM opportunity WHERE status='promoted'")).toBe(1);
        expect(count("SELECT COUNT(*) n FROM app_config WHERE key=?", `scope.done.${id}`)).toBe(1);
        // graduation narration appended to the company's incubation chat
        expect(
            count(
                "SELECT COUNT(*) n FROM message WHERE company_id=? AND content LIKE '%is live as a company%'",
                id,
            ),
        ).toBe(1);
    });

    it("gives same-named spins distinct, unique name slugs", async () => {
        const a = startSpinLogic("a scheduling tool for tutors", LEAN);
        const b = startSpinLogic("a scheduling tool for tutors", LEAN);
        expect(a.slug).toBeTruthy();
        expect(b.slug).toBeTruthy();
        expect(a.slug).not.toBe(b.slug); // second one got a " 2" suffix → different slug
        const names = sqlite
            .prepare("SELECT name FROM company")
            .all()
            .map((r) => (r as { name: string }).name);
        expect(new Set(names).size).toBe(names.length); // all names unique
    });

    it("continue without research: skips scouting straight to a spec from the idea", async () => {
        const { id } = startSpinLogic("a CRM for plumbers", LEAN);
        expect(readDraft(id)?.spinStatus).toBe("scouting");

        // Skip the scout: synthesize one candidate from the thought → 'specing'
        expect(continueWithoutResearchLogic(id).ok).toBe(true);
        const skipped = readDraft(id);
        expect(skipped?.spinStatus).toBe("specing");
        expect(skipped?.candidates).toHaveLength(1);

        // The engine drafts the spec directly (no proposals stage was ever entered)
        await spinSpec(new Set());
        const specced = readDraft(id);
        expect(specced?.spinStatus).toBe("spec");
        expect(specced?.spec?.product).toBeTruthy();

        // guarded: a second skip after it already advanced is a no-op
        expect(continueWithoutResearchLogic(id).ok).toBe(false);
    });

    it("graduate is idempotent - a second approve returns the same id, makes no dupes", async () => {
        const { id } = startSpinLogic("schedule tutors", LEAN);
        await spinScout(new Set());
        const c = readDraft(id)?.candidates?.[0]?.id ?? "";
        pickOpportunityLogic(id, c);
        await spinSpec(new Set());
        const first = graduateCompany(id);
        const second = graduateCompany(id);
        expect(second.id).toBe(first.id);
        expect(count("SELECT COUNT(*) n FROM company")).toBe(1);
        expect(count("SELECT COUNT(*) n FROM action")).toBe(1);
    });

    it("guards the order: can't pick before proposals, can't approve before spec", async () => {
        const { id } = startSpinLogic("x", LEAN);
        // still 'scouting' - pick + approve are no-ops (company stays a draft, no action)
        expect(pickOpportunityLogic(id, "nope").ok).toBe(false);
        expect(graduateCompany(id).ok).toBe(false);
        expect(count("SELECT COUNT(*) n FROM action")).toBe(0);
        expect(
            (sqlite.prepare("SELECT status FROM company WHERE id=?").get(id) as { status: string })
                .status,
        ).toBe("draft");
    });
});
