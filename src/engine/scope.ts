import { randomUUID } from "node:crypto";
import { sqlite } from "../db/index.js";
import { dispatchAI } from "./dispatch.js";

// scope.ts — the engine pass that turns a freshly-created company (just a thought on
// company.thesis) into a real opportunity + first buildable slice. Design notes (grounded
// in the pre-impl critique):
//   • ONE company per tick (bounded fan-out — never a claude-subprocess thundering herd).
//   • Idempotent via a DURABLE app_config marker `scope.done.<id>` (survives restart AND
//     resetDemo, which only clears actions/runs) — not the fragile "zero actions" heuristic.
//   • All AI (dispatchAI, may spawn `claude -p`) runs OUTSIDE the DB transaction, under an
//     AbortSignal timeout so a hung child can't pin the guard Set. The emit is ONE atomic
//     sqlite.transaction that re-checks the marker + active status inside (closes the
//     check-then-act gap → a Set bypass or mid-scope restart yields 0 or 1 emission).
//   • The first slice is FORCED to the signup archetype (payload.doneWhen "http-signup") —
//     the only thing HttpValidator can certify — so "green → ships" actually fires.

const DISPATCH_MS = 90_000;
const SIGNUP_TITLE = "A visitor can sign up on a live URL";
const markKey = (companyId: string) => `scope.done.${companyId}`;

// One active company with NO scope marker yet, oldest first.
const PICK = sqlite.prepare(`
  SELECT c.id AS id, c.thesis AS thesis
  FROM company c
  WHERE c.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM app_config a
      WHERE a.scope = 'global' AND a.key = 'scope.done.' || c.id
    )
  ORDER BY c.created_at ASC
  LIMIT 1
`);
const HAS_MARK = sqlite.prepare("SELECT 1 FROM app_config WHERE scope = 'global' AND key = ?");
const IS_ACTIVE = sqlite.prepare("SELECT 1 FROM company WHERE id = ? AND status = 'active'");
const INS_OPP = sqlite.prepare(`
  INSERT INTO opportunity (id, thought, title, thesis, score, status, created_at)
  VALUES (?, ?, ?, ?, ?, 'promoted', ?)
`);
const INS_MSG = sqlite.prepare(`
  INSERT INTO message (id, company_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)
`);
const INS_ACTION = sqlite.prepare(`
  INSERT INTO action (id, company_id, type, title, reversible, status, priority, payload, created_at)
  VALUES (?, ?, 'code', ?, 1, 'queued', 1, ?, ?)
`);
const SET_MARK = sqlite.prepare(`
  INSERT INTO app_config (scope, key, value, updated_at) VALUES ('global', ?, 'true', ?)
  ON CONFLICT(scope, key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at
`);

type Opp = { title: string; thesis: string; score: number };

// Atomic emission — re-checks marker + active INSIDE the txn, then writes opportunity +
// narration + first action + marker as one unit (staggered created_at keeps order stable).
const emit = sqlite.transaction((companyId: string, thought: string, opp: Opp, spec: string) => {
    if (HAS_MARK.get(markKey(companyId))) return;
    if (!IS_ACTIVE.get(companyId)) return;
    const now = Date.now();
    INS_OPP.run(randomUUID(), thought, opp.title, opp.thesis, opp.score, now);
    INS_MSG.run(
        randomUUID(),
        companyId,
        `Found an opportunity — ${opp.title}. ${opp.thesis} (demand ${opp.score}/100).`,
        now,
    );
    INS_MSG.run(
        randomUUID(),
        companyId,
        `${spec} I'll build a signup page and ship it once it passes the live check.`,
        now + 1,
    );
    INS_ACTION.run(
        randomUUID(),
        companyId,
        SIGNUP_TITLE,
        JSON.stringify({ doneWhen: "http-signup" }),
        now + 2,
    );
    SET_MARK.run(markKey(companyId), now);
});

export async function scopeNext(inflight: Set<string>): Promise<void> {
    const row = PICK.get() as { id: string; thesis: string } | undefined;
    if (!row || inflight.has(row.id)) return;
    inflight.add(row.id); // synchronous, before any await — closes the double-claim window
    try {
        const opp = await scoreOpportunity(row.thesis);
        const spec = await draftSpec(opp);
        emit(row.id, row.thesis, opp, spec);
    } catch {
        // emit is atomic (rolls back on error) → nothing partial committed; next tick retries.
    } finally {
        inflight.delete(row.id);
    }
}

// ---- AI drivers (never throw — internal deterministic fallback) -------------------------

function fallbackOpp(thought: string): Opp {
    const title =
        thought
            .split(/\s+/)
            .slice(0, 6)
            .join(" ")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .slice(0, 60) || "New opportunity";
    return { title, thesis: thought.slice(0, 240), score: 72 };
}

async function scoreOpportunity(thought: string): Promise<Opp> {
    const fb = fallbackOpp(thought);
    try {
        const r = await dispatchAI("opportunities", {
            system: 'Return ONLY minified JSON: {"title":string,"thesis":string,"score":number}. score is demand 0-100. No prose, no code fences.',
            prompt: `Thought: ${thought}\nName and score this as a small SaaS opportunity.`,
            maxTokens: 400,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const j = extractJson(r.text);
        return {
            title: str(j?.title, fb.title, 60),
            thesis: str(j?.thesis, fb.thesis, 240),
            score: num(j?.score, fb.score),
        };
    } catch {
        return fb;
    }
}

async function draftSpec(opp: Opp): Promise<string> {
    const fb = "First slice: a landing page with an email signup — enough to prove demand.";
    try {
        const r = await dispatchAI("plan", {
            system: "Reply with ONE short sentence (max 22 words) naming the first buildable slice. No preamble, no list.",
            prompt: `Product: ${opp.title}\nThesis: ${opp.thesis}\nWhat is the very first slice to build?`,
            maxTokens: 120,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const s = r.text.trim().split("\n")[0]?.trim();
        return s ? s.slice(0, 160) : fb;
    } catch {
        return fb;
    }
}

// Defensive parse: strip code fences, take the first balanced {...}, JSON.parse or null.
function extractJson(text: string): Record<string, unknown> | null {
    let t = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
    const i = t.indexOf("{");
    const j = t.lastIndexOf("}");
    if (i >= 0 && j > i) t = t.slice(i, j + 1);
    try {
        const v = JSON.parse(t);
        return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function str(v: unknown, fb: string, max: number): string {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fb;
}
function num(v: unknown, fb: number): number {
    return typeof v === "number" && Number.isFinite(v)
        ? Math.max(0, Math.min(100, Math.round(v)))
        : fb;
}
