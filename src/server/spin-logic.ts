import { and, eq } from "drizzle-orm";
import { scoreTotal } from "../config/spin.js";
import { actions, appConfig, companies, db, drafts, messages, opportunities } from "../db/index.js";

// The spin flow's DB logic, extracted from the createServerFn wrappers in actions.ts so it's
// unit-testable without the Start request runtime. Every function is a TINY write only (the
// heavy AI lives in the engine's spin passes) and is status-gated so a double-click / stale
// poll is a harmless no-op. actions.ts is a thin server-fn shell over these.

export function startSpinLogic(thought: string, preset: string): { id: string } {
    const t = thought.trim();
    if (!t) throw new Error("Describe the idea first.");
    const draft = db
        .insert(drafts)
        .values({
            thought: t,
            status: "scouting",
            guardrails: { preset: preset || "balanced" },
            data: {},
        })
        .returning()
        .get();
    return { id: draft.id };
}

export function pickOpportunityLogic(draftId: string, candidateId: string): { ok: boolean } {
    const draft = db.select().from(drafts).where(eq(drafts.id, draftId)).get();
    if (!draft || draft.status !== "proposals") return { ok: false };
    if (!(draft.data.candidates ?? []).some((c) => c.id === candidateId)) return { ok: false };
    db.update(drafts)
        .set({ status: "specing", data: { ...draft.data, pickedId: candidateId } })
        .where(and(eq(drafts.id, draftId), eq(drafts.status, "proposals")))
        .run();
    return { ok: true };
}

export function reSpinLogic(draftId: string): { ok: boolean } {
    const draft = db.select().from(drafts).where(eq(drafts.id, draftId)).get();
    if (!draft || (draft.status !== "proposals" && draft.status !== "failed")) return { ok: false };
    db.update(drafts).set({ status: "scouting", data: {} }).where(eq(drafts.id, draft.id)).run();
    return { ok: true };
}

export function resetPickLogic(draftId: string): { ok: boolean } {
    const draft = db.select().from(drafts).where(eq(drafts.id, draftId)).get();
    if (!draft || (draft.status !== "specing" && draft.status !== "spec")) return { ok: false };
    db.update(drafts)
        .set({ status: "proposals", data: { candidates: draft.data.candidates ?? [] } })
        .where(eq(drafts.id, draft.id))
        .run();
    return { ok: true };
}

// Commit the spec to a REAL company. Because the spin flow already did the scoping (the user
// chose the bet and reviewed the spec), the company is created ALREADY-SCOPED: promoted
// opportunity + founding narration + first buildable action (forced to the http-signup
// archetype, the only doneWhen HttpValidator certifies) + a scope.done marker so the engine's
// scope pass SKIPS it and the runner goes straight to building. Idempotent on the draft status.
export function commitDraftLogic(draftId: string): { ok: boolean; id?: string } {
    const draft = db.select().from(drafts).where(eq(drafts.id, draftId)).get();
    if (!draft) return { ok: false };
    // Idempotent: a re-commit (double-click, retried request) returns the existing company.
    // Checked BEFORE the status gate — once committed the status is 'committed', not 'spec'.
    if (draft.companyId) return { ok: true, id: draft.companyId };
    if (draft.status !== "spec") return { ok: false };
    const spec = draft.data.spec;
    if (!spec) return { ok: false };
    const branding = draft.data.branding;
    const picked = (draft.data.candidates ?? []).find((c) => c.id === draft.data.pickedId);

    const company = db
        .insert(companies)
        .values({
            name: spec.product.slice(0, 48),
            thesis: draft.thought,
            autopilot: "on",
            domain: branding?.domain,
            pricing: { plan: "Pro", priceUsd: spec.pricingUsd, interval: "month" },
        })
        .returning()
        .get();

    const at = company.createdAt; // narration back-dated here so it never outranks a user turn
    const demand = picked ? Math.round(scoreTotal(picked.scores) * 10) : 72;
    db.insert(opportunities)
        .values({
            thought: draft.thought,
            title: spec.product.slice(0, 60),
            thesis: (spec.tagline || picked?.pain || draft.thought).slice(0, 240),
            score: demand,
            status: "promoted",
        })
        .run();
    const firstTitle = spec.slices[0]?.title ?? "A visitor can sign up on a live URL";
    db.insert(messages)
        .values([
            {
                companyId: company.id,
                role: "assistant",
                content: `${spec.product} — ${spec.tagline} Building the first slice now.`,
                createdAt: at,
            },
            {
                companyId: company.id,
                role: "assistant",
                content: `First slice: ${firstTitle}. I'll ship it once it passes the live check.`,
                createdAt: new Date(at.getTime() + 1),
            },
        ])
        .run();
    db.insert(actions)
        .values({
            companyId: company.id,
            type: "code",
            title: firstTitle,
            reversible: true,
            status: "queued",
            priority: 1,
            payload: { doneWhen: "http-signup" },
        })
        .run();
    db.insert(appConfig)
        .values({ scope: "global", key: `scope.done.${company.id}`, value: true })
        .onConflictDoNothing()
        .run();
    db.update(drafts)
        .set({ status: "committed", companyId: company.id })
        .where(eq(drafts.id, draft.id))
        .run();
    return { ok: true, id: company.id };
}
