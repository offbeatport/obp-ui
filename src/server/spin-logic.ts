import { and, eq } from "drizzle-orm";
import { type Guardrails, type SpinData, scoreTotal } from "../config/spin.js";
import { actions, appConfig, companies, db, messages, opportunities } from "../db/index.js";

// The spin flow's DB logic. A company is created immediately in status 'draft' (this is what
// "spin up" does); its spin sub-stage lives in company.spinStatus + company.spin, and the
// incubation chat is the company's own messages. These fns do TINY writes only (the heavy AI is
// the engine's spin passes) and are status-gated so a double-click / stale poll is a no-op.
// actions.ts is a thin server-fn shell over these.

function deriveName(thought: string): string {
    return (
        thought
            .split(/\s+/)
            .slice(0, 4)
            .join(" ")
            .replace(/[^\w\s-]/g, "")
            .slice(0, 40) || "New company"
    );
}

// "Spin up" — create the draft company. Returns its id; the UI routes to /companies/<id> where
// the incubation chat lives. The engine's spinScout pass then fills spin.candidates.
export function startSpinLogic(thought: string, guardrails: Guardrails): { id: string } {
    const t = thought.trim();
    if (!t) throw new Error("Describe the idea first.");
    const company = db
        .insert(companies)
        .values({
            name: deriveName(t),
            thesis: t,
            status: "draft",
            spinStatus: "scouting",
            spin: { guardrails },
        })
        .returning()
        .get();
    return { id: company.id };
}

// The spin payload of a draft company currently at one of `from` (else null — not actionable).
function draftAt(companyId: string, from: string[]): SpinData | null {
    const c = db.select().from(companies).where(eq(companies.id, companyId)).get();
    if (!c || c.status !== "draft" || !c.spinStatus || !from.includes(c.spinStatus)) return null;
    return c.spin ?? {};
}

// Pick one candidate to spec out → 'specing' so spinSpec drafts the company spec + branding.
export function pickOpportunityLogic(companyId: string, candidateId: string): { ok: boolean } {
    const spin = draftAt(companyId, ["proposals"]);
    if (!spin || !(spin.candidates ?? []).some((c) => c.id === candidateId)) return { ok: false };
    db.update(companies)
        .set({ spinStatus: "specing", spin: { ...spin, pickedId: candidateId } })
        .where(and(eq(companies.id, companyId), eq(companies.spinStatus, "proposals")))
        .run();
    return { ok: true };
}

// Re-roll: throw the current candidates away and scout again (keeps the guardrail preset).
export function reSpinLogic(companyId: string): { ok: boolean } {
    const spin = draftAt(companyId, ["proposals", "failed"]);
    if (!spin) return { ok: false };
    db.update(companies)
        .set({ spinStatus: "scouting", spin: { guardrails: spin.guardrails } })
        .where(eq(companies.id, companyId))
        .run();
    return { ok: true };
}

// Back to the candidate list from a drafted spec ("choose a different angle") — keeps candidates.
export function resetPickLogic(companyId: string): { ok: boolean } {
    const spin = draftAt(companyId, ["specing", "spec"]);
    if (!spin) return { ok: false };
    db.update(companies)
        .set({
            spinStatus: "proposals",
            spin: { guardrails: spin.guardrails, candidates: spin.candidates ?? [] },
        })
        .where(eq(companies.id, companyId))
        .run();
    return { ok: true };
}

// Approve the reviewed spec → GRADUATE the draft company to a live one. Flips status draft→active,
// applies the product name/domain/pricing, and scopes it (promoted opportunity + first http-signup
// action + scope.done marker + narration) so the runner builds immediately and scope.ts skips it.
// Idempotent: a re-approve of an already-graduated company just returns its id.
export function graduateCompany(companyId: string): { ok: boolean; id?: string } {
    const c = db.select().from(companies).where(eq(companies.id, companyId)).get();
    if (!c) return { ok: false };
    if (c.status !== "draft") return { ok: true, id: companyId }; // already graduated
    if (c.spinStatus !== "spec") return { ok: false };
    const spin = c.spin ?? {};
    const spec = spin.spec;
    if (!spec) return { ok: false };
    const branding = spin.branding;
    const picked = (spin.candidates ?? []).find((x) => x.id === spin.pickedId);

    db.update(companies)
        .set({
            status: "active",
            spinStatus: null,
            spin: null,
            name: spec.product.slice(0, 48),
            domain: branding?.domain,
            pricing: { plan: "Pro", priceUsd: spec.pricingUsd, interval: "month" },
            autopilot: "on",
        })
        .where(eq(companies.id, companyId))
        .run();

    const demand = picked ? Math.round(scoreTotal(picked.scores) * 10) : 72;
    db.insert(opportunities)
        .values({
            thought: c.thesis,
            title: spec.product.slice(0, 60),
            thesis: (spec.tagline || picked?.pain || c.thesis).slice(0, 240),
            score: demand,
            status: "promoted",
        })
        .run();
    const firstTitle = spec.slices[0]?.title ?? "A visitor can sign up on a live URL";
    const now = Date.now();
    db.insert(messages)
        .values([
            {
                companyId,
                role: "assistant",
                content: `${spec.product} is live as a company — building the first slice now.`,
                createdAt: new Date(now),
            },
            {
                companyId,
                role: "assistant",
                content: `First slice: ${firstTitle}. I'll ship it once it passes the live check.`,
                createdAt: new Date(now + 1),
            },
        ])
        .run();
    db.insert(actions)
        .values({
            companyId,
            type: "code",
            title: firstTitle,
            reversible: true,
            status: "queued",
            priority: 1,
            payload: { doneWhen: "http-signup" },
        })
        .run();
    db.insert(appConfig)
        .values({ scope: "global", key: `scope.done.${companyId}`, value: true })
        .onConflictDoNothing()
        .run();
    return { ok: true, id: companyId };
}
