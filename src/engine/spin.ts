import { randomUUID } from "node:crypto";
import {
    type Branding,
    type Candidate,
    type CompanySpec,
    type Evidence,
    type EvidenceKind,
    type Guardrails,
    type OppScores,
    SCORE_KEYS,
    type SpecSlice,
    type SpinData,
    guardrailsText,
    paletteFor,
    scoreTotal,
} from "../config/spin.js";
import { sqlite } from "../db/index.js";
import { graduateCompany } from "../server/spin-logic.js";
import { extractJson, extractJsonArray, str } from "./coerce.js";
import { clip, dlog } from "./debug.js";
import { dispatchAI } from "./dispatch.js";
import { singleFlight } from "./single-flight.js";

// spin.ts - the engine passes behind the "spin up a company" chat. A DRAFT COMPANY (company row,
// status='draft') is one spin session: company.thesis is the thought, company.spinStatus the
// sub-stage, company.spin the payload (candidates/pickedId/spec/branding), and the incubation
// chat is the company's own messages. Web fns only do tiny status flips; the heavy AI lives
// HERE, in the executor, mirroring scope.ts's discipline:
//   • ONE draft company per tick per pass (bounded fan-out - no claude thundering herd).
//   • All dispatchAI runs OUTSIDE the DB txn, under an AbortSignal timeout.
//   • The emit is ONE atomic sqlite.transaction that re-reads + re-checks spinStatus INSIDE the
//     txn (closes the check-then-act gap so a Set bypass / mid-pass restart yields 0 or 1 write).
//   • Every AI driver has a deterministic fallback and NEVER throws - an offline host still
//     produces a usable set of candidates / a spec, so the flow always completes.
//
// Lifecycle:  scouting --spinScout--> proposals --(pickOpportunity)--> specing
//             specing --spinSpec--> spec --(approve = graduateCompany)--> active company

const DISPATCH_MS = 90_000;

type DraftRow = { id: string; thought: string; spin: string | null };

const PICK_SCOUTING = sqlite.prepare(`
  SELECT id, thesis AS thought, spin FROM company
  WHERE status = 'draft' AND spin_status = 'scouting' ORDER BY created_at ASC LIMIT 1
`);
const PICK_SPECING = sqlite.prepare(`
  SELECT id, thesis AS thought, spin FROM company
  WHERE status = 'draft' AND spin_status = 'specing' ORDER BY created_at ASC LIMIT 1
`);
const READ_STATUS = sqlite.prepare("SELECT spin_status AS status, spin FROM company WHERE id = ?");
const WRITE_SPIN = sqlite.prepare(
    "UPDATE company SET spin_status = ?, spin = ? WHERE id = ? AND spin_status = ?",
);
const FAIL_SPIN = sqlite.prepare(
    "UPDATE company SET spin_status = 'failed' WHERE id = ? AND spin_status = ?",
);

// Atomic spinStatus advance: re-read the row inside the txn, bail unless it's still in `from`
// (an earlier tick / another pass may have moved it), then merge `patch` into spin + flip to
// `to`. Returns nothing; the guarded UPDATE makes a lost race a harmless no-op.
//
// `expectPickedId` (spinSpec only): also bail unless the CURRENT pick still matches the one the
// spec was drafted for. Closes the re-pick race - if the founder chose a different angle (reset
// + re-pick) while the AI ran, an in-flight spec for the old candidate must NOT overwrite it.
const advance = sqlite.transaction(
    (id: string, from: string, to: string, patch: Partial<SpinData>, expectPickedId?: string) => {
        const row = READ_STATUS.get(id) as
            | { status: string | null; spin: string | null }
            | undefined;
        if (!row || row.status !== from) return;
        const current = parseData(row.spin);
        if (expectPickedId !== undefined && current.pickedId !== expectPickedId) return;
        const merged = { ...current, ...patch };
        WRITE_SPIN.run(to, JSON.stringify(merged), id, from);
    },
);

// ---- pass 1: scout - a fresh thought → 3 scored opportunity candidates -------------------
export async function spinScout(inflight: Set<string>): Promise<void> {
    const row = PICK_SCOUTING.get() as DraftRow | undefined;
    if (!row) return;
    await singleFlight(inflight, row.id, async () => {
        try {
            const spin = parseData(row.spin);
            dlog("spin", `scout: company ${row.id} · "${clip(row.thought, 60)}"`);
            const candidates = await scoutCandidates(row.thought, spin.guardrails, spin.criteria);
            dlog("spin", `scout: company ${row.id} → ${candidates.length} candidates → proposals`);
            // clear criteria once consumed (undefined drops from the merged JSON)
            advance.immediate(row.id, "scouting", "proposals", { candidates, criteria: undefined });
            // Open the chat with the result so it reads as a conversation.
            if ((READ_STATUS.get(row.id) as { status: string })?.status === "proposals") {
                INSERT_MSG.run(
                    randomUUID(),
                    row.id,
                    "assistant",
                    `I found ${candidates.length} opportunities: ${candidates.map((c) => c.name).join(", ")}. Ask me to refine (e.g. "target agencies", "make it cheaper"), or tell me which to spec out.`,
                    Date.now(),
                );
            }
        } catch {
            // scoutCandidates never throws (has a fallback); only a DB error lands here. Mark the
            // draft failed so the UI shows an error state instead of polling 'scouting' forever.
            try {
                FAIL_SPIN.run(row.id, "scouting");
            } catch {
                /* give up - next boot's operator can inspect */
            }
        }
    });
}

// ---- pass 2: spec - the picked candidate → full company spec + branding -------------------
export async function spinSpec(inflight: Set<string>): Promise<void> {
    const row = PICK_SPECING.get() as DraftRow | undefined;
    if (!row) return;
    await singleFlight(inflight, row.id, async () => {
        const data = parseData(row.spin);
        const picked = data.candidates?.find((c) => c.id === data.pickedId) ?? data.candidates?.[0];
        if (!picked) {
            FAIL_SPIN.run(row.id, "specing"); // pick lost - shouldn't happen, fail loudly
            return;
        }
        try {
            dlog("spin", `spec: company ${row.id} · picked "${picked.name}"`);
            const { spec, branding } = await draftSpecAndBranding(
                picked,
                row.thought,
                data.guardrails,
                data.editNote,
            );
            // Guard on the pick-time pickedId: a mid-flight re-pick (reset → pick another) must
            // discard this now-stale spec. Undefined (defensive candidates[0] fallback) → no guard.
            // Clear editNote once applied.
            advance.immediate(
                row.id,
                "specing",
                "spec",
                { spec, branding, editNote: undefined },
                data.pickedId,
            );
            if ((READ_STATUS.get(row.id) as { status: string })?.status === "spec") {
                INSERT_MSG.run(
                    randomUUID(),
                    row.id,
                    "assistant",
                    `Here's the ${spec.product} spec - $${spec.pricingUsd}/mo, ${spec.slices.length} slices. Want any changes (price, stack, slices), or should I build the company?`,
                    Date.now(),
                );
            }
        } catch {
            try {
                FAIL_SPIN.run(row.id, "specing");
            } catch {
                /* give up */
            }
        }
    });
}

// ---- pass 3: chat - a ChatGPT-style conversation that also DRIVES the flow ----------------
// The founder can ask anything ("why is the WTP score low?") and steer it ("re-scout but target
// agencies", "go with #2", "make it cheaper", "create it"). The model returns a reply + ONE
// optional intent, which we route to the existing scout/spec/commit machinery.

const INSERT_MSG = sqlite.prepare(
    "INSERT INTO message (id, company_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
);
// A draft company whose latest message is an unanswered user turn (mirrors chat.ts).
const PICK_CHAT = sqlite.prepare(`
  SELECT c.id AS id, c.thesis AS thought, c.spin_status AS status, c.spin AS spin
  FROM company c
  WHERE c.status = 'draft'
    AND (SELECT m.role FROM message m WHERE m.company_id = c.id
         ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) = 'user'
  ORDER BY c.created_at ASC LIMIT 1
`);
const READ_TRANSCRIPT = sqlite.prepare(
    "SELECT role, content FROM message WHERE company_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 24",
);
// Non-commit intents mutate spin + spinStatus in one guarded write (status re-checked inside).
const APPLY_CHAT = sqlite.transaction(
    (id: string, patch: Partial<SpinData>, to: string, allowed: string[]) => {
        const row = READ_STATUS.get(id) as
            | { status: string | null; spin: string | null }
            | undefined;
        if (!row || !row.status || !allowed.includes(row.status)) return false;
        WRITE_SPIN.run(to, JSON.stringify({ ...parseData(row.spin), ...patch }), id, row.status);
        return true;
    },
);

type ChatMsg = { role: string; content: string };
type ChatAction =
    | { type: "none" }
    | { type: "rescout"; criteria: string }
    | { type: "pick"; candidate: string }
    | { type: "editSpec"; note: string }
    | { type: "commit" };

export async function spinChat(inflight: Set<string>): Promise<void> {
    const row = PICK_CHAT.get() as
        | { id: string; thought: string; status: string | null; spin: string | null }
        | undefined;
    if (!row) return;
    await singleFlight(inflight, row.id, async () => {
        const data = parseData(row.spin);
        try {
            const transcript = READ_TRANSCRIPT.all(row.id) as ChatMsg[];
            dlog(
                "spin",
                `chat: company ${row.id} · stage ${row.status ?? "spec"} · ${transcript.length} msgs`,
            );
            const { reply, action } = await chatTurn(
                row.thought,
                row.status ?? "spec",
                data,
                transcript,
            );
            dlog("spin", `chat: company ${row.id} → action=${action.type}`);
            // Always answer; then route the intent (status-gated so it can't corrupt a pass).
            INSERT_MSG.run(randomUUID(), row.id, "assistant", reply, Date.now());
            applyChatAction(row.id, action, data);
        } catch {
            // never leave the turn unanswered - drop a graceful fallback line.
            try {
                INSERT_MSG.run(
                    randomUUID(),
                    row.id,
                    "assistant",
                    "I hit a snag on that - try rephrasing, or use the buttons.",
                    Date.now(),
                );
            } catch {
                /* give up */
            }
        }
    });
}

function applyChatAction(id: string, action: ChatAction, data: SpinData): void {
    switch (action.type) {
        case "rescout":
            // wipe the drafted results, remember the new criteria, re-scout from scratch
            APPLY_CHAT(
                id,
                {
                    criteria: action.criteria,
                    candidates: undefined,
                    pickedId: undefined,
                    spec: undefined,
                    branding: undefined,
                    editNote: undefined,
                },
                "scouting",
                ["proposals", "spec", "specing", "failed"],
            );
            break;
        case "pick": {
            const picked = resolveCandidate(action.candidate, data.candidates ?? []);
            if (picked) APPLY_CHAT(id, { pickedId: picked.id }, "specing", ["proposals"]);
            break;
        }
        case "editSpec":
            APPLY_CHAT(id, { editNote: action.note }, "specing", ["spec"]);
            break;
        case "commit":
            // graduateCompany runs its own txn (idempotent, gated to a draft company at 'spec').
            graduateCompany(id);
            break;
        default:
            break; // "none" - chat only
    }
}

// Resolve a candidate from a loose reference: 1-based number, exact id, or name substring.
function resolveCandidate(ref: string, candidates: Candidate[]): Candidate | undefined {
    const s = ref.trim().toLowerCase();
    const n = Number.parseInt(s.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= candidates.length) return candidates[n - 1];
    return (
        candidates.find((c) => c.id === ref) ??
        candidates.find((c) => c.name.toLowerCase().includes(s) && s.length > 1)
    );
}

async function chatTurn(
    thought: string,
    status: string,
    data: SpinData,
    transcript: ChatMsg[],
): Promise<{ reply: string; action: ChatAction }> {
    const state = describeState(thought, status, data);
    const convo = transcript
        .map((m) => `${m.role === "user" ? "Founder" : "You"}: ${m.content}`)
        .join("\n");
    try {
        const r = await dispatchAI("chat", {
            system:
                "You are the assistant helping a founder spin up a company, in a chat. Answer anything " +
                "conversationally AND, when the founder clearly wants to act, take ONE action. Return " +
                'ONLY minified JSON: {"reply":string,"action":{...}}. action.type is one of: ' +
                '"none" (just answer); "rescout" with "criteria" (regenerate opportunities with a new ' +
                'angle/constraint); "pick" with "candidate" (a name or 1-based number, to spec it out); ' +
                '"editSpec" with "note" (change the drafted spec, e.g. price/stack/slices); "commit" ' +
                "(create the company from the reviewed spec). Only act on a clear request; otherwise " +
                'use {"type":"none"}. reply is 1-4 warm, concrete sentences. No prose outside the JSON.',
            prompt: `Current state:\n${state}\n\nConversation so far:\n${convo}\n\nReply to the founder's latest message.`,
            maxTokens: 700,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const last = transcript.filter((m) => m.role === "user").pop()?.content ?? "";
        const j = extractJson(r.text);
        // Preferred: the model emitted the {reply, action} envelope.
        if (j && typeof j.reply === "string") {
            return {
                reply: str(j.reply, fallbackReply(status), 800),
                action: coerceAction(j.action),
            };
        }
        // Weaker models (e.g. haiku) often answer in plain prose. Use that prose as the reply,
        // but still route intent with the deterministic heuristic so "go with 1" etc. work.
        const h = heuristicTurn(last, status, data.candidates ?? []);
        return { reply: r.text.trim().slice(0, 800) || h.reply, action: h.action };
    } catch {
        // Offline / dispatch failure: pure heuristic on the last user turn.
        const last = transcript.filter((m) => m.role === "user").pop()?.content ?? "";
        return heuristicTurn(last, status, data.candidates ?? []);
    }
}

// One-paragraph state summary the model reasons over.
function describeState(thought: string, status: string, data: SpinData): string {
    const parts = [`thought: "${thought}"`, `stage: ${status}`];
    if (data.candidates?.length) {
        parts.push(
            `candidates:\n${data.candidates
                .map(
                    (c, i) =>
                        `  ${i + 1}. ${c.name} - ${c.wedge} (score ${scoreTotal(c.scores).toFixed(1)}/10)`,
                )
                .join("\n")}`,
        );
    }
    if (data.pickedId) {
        const p = data.candidates?.find((c) => c.id === data.pickedId);
        if (p) parts.push(`picked: ${p.name}`);
    }
    if (data.spec) {
        parts.push(
            `spec: ${data.spec.product} - ${data.spec.tagline} · $${data.spec.pricingUsd}/mo · stack ${data.spec.stack.join(", ")} · ${data.spec.slices.length} slices`,
        );
    }
    return parts.join("\n");
}

function coerceAction(v: unknown): ChatAction {
    if (!v || typeof v !== "object") return { type: "none" };
    const o = v as Record<string, unknown>;
    switch (o.type) {
        case "rescout":
            return { type: "rescout", criteria: str(o.criteria, "", 400) };
        case "pick":
            return { type: "pick", candidate: str(o.candidate, "", 60) };
        case "editSpec":
            return { type: "editSpec", note: str(o.note, "", 400) };
        case "commit":
            return { type: "commit" };
        default:
            return { type: "none" };
    }
}

function fallbackReply(status: string): string {
    if (status === "scouting") return "Scouting opportunities now - one moment.";
    if (status === "specing") return "Drafting the company spec - one moment.";
    return "Got it.";
}

// Deterministic routing (the offline path AND the fallback when a weak model answers in prose):
// detect the founder's intent from keywords + candidate-name overlap.
function heuristicTurn(
    text: string,
    status: string,
    candidates: Candidate[],
): { reply: string; action: ChatAction } {
    const t = text.toLowerCase();
    if (
        /\b(re-?scout|different|other ideas|another (set|angle|idea)|not these|something else)\b/.test(
            t,
        )
    ) {
        return {
            reply: "Re-scouting with that in mind.",
            action: { type: "rescout", criteria: text },
        };
    }
    if (status === "proposals") {
        const wantsPick =
            /\b(go with|let'?s go|pick|choose|select|i'?ll take|take the|do the|spec (it|out)|build (the|this)|go for)\b/.test(
                t,
            ) || /^\s*#?[1-5]\b/.test(text.trim());
        const c = wantsPick ? matchCandidate(t, candidates) : undefined;
        if (c) {
            return {
                reply: `Great - drafting the ${c.name} spec.`,
                action: { type: "pick", candidate: c.id },
            };
        }
    }
    if (status === "spec") {
        if (
            /\b(create|build|ship|make) it\b|\blet'?s (go|build|ship)\b|\bcommit\b|\bgo live\b/.test(
                t,
            )
        ) {
            return { reply: "Creating the company now.", action: { type: "commit" } };
        }
        if (
            /\b(cheaper|price|pricing|\$|stack|slice|drop|add|change|remove|rename|tagline|trial|target)\b/.test(
                t,
            )
        ) {
            return { reply: "Updating the spec.", action: { type: "editSpec", note: text } };
        }
    }
    return { reply: fallbackReply(status), action: { type: "none" } };
}

// Find which candidate the founder means: a 1-based number, or the best name-word overlap
// (so "go with the conflict check one" → "Conflict Check Screener").
function matchCandidate(text: string, candidates: Candidate[]): Candidate | undefined {
    const num = text.match(/#?\b([1-5])\b/);
    if (num) {
        const c = candidates[Number(num[1]) - 1];
        if (c) return c;
    }
    let best: Candidate | undefined;
    let bestHits = 0;
    for (const c of candidates) {
        const name = c.name.toLowerCase();
        if (name.length > 2 && text.includes(name)) return c;
        const hits = name
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 3 && text.includes(w)).length;
        if (hits > bestHits) {
            bestHits = hits;
            best = c;
        }
    }
    return bestHits > 0 ? best : undefined;
}

// ---- AI drivers (never throw - deterministic fallback) -----------------------------------

async function scoutCandidates(
    thought: string,
    guardrails: Guardrails | undefined,
    criteria?: string,
): Promise<Candidate[]> {
    const fb = fallbackCandidates(thought);
    const extra = criteria ? `\nExtra criteria from the founder (MUST honor): ${criteria}` : "";
    try {
        const r = await dispatchAI("research", {
            system:
                "You are a startup scout finding small, solo-buildable SaaS bets. Return ONLY a " +
                "minified JSON array of exactly 5 objects - no prose, no code fences. Each object: " +
                '{"name":string,"icp":string,"wedge":string,"pain":string,"scores":' +
                '{"buyer":int,"pain":int,"wtp":int,"timing":int,"build":int,"legal":int,"distro":int,"pricing":int},' +
                '"evidence":[{"kind":"demand"|"gap"|"price","text":string,"source":string}],' +
                '"firstSlice":{"title":string,"doneWhen":string}}. scores are integers 0-10. ' +
                "Give 2-3 evidence items each. name is a short product angle (2-3 words).",
            prompt: `Founder's thought: ${thought}\nGuardrails (MUST honor): ${guardrailsText(guardrails)}.${extra}\nPropose 5 distinct, scored SaaS opportunities that a solo founder could ship.`,
            maxTokens: 2200,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const arr = extractJsonArray(r.text);
        const parsed = arr
            .map((raw, i) => toCandidate(raw, fb[i % fb.length]))
            .filter((c): c is Candidate => c !== null);
        if (parsed.length === 0) return fb;
        // Rank by average score (best bet first) - the UI leads with the strongest candidate.
        return parsed.sort((a, b) => scoreTotal(b.scores) - scoreTotal(a.scores));
    } catch {
        return fb;
    }
}

async function draftSpecAndBranding(
    picked: Candidate,
    thought: string,
    guardrails: Guardrails | undefined,
    editNote?: string,
): Promise<{ spec: CompanySpec; branding: Branding }> {
    const fb = fallbackSpec(picked, thought);
    const extra = editNote ? `\nApply this change the founder asked for: ${editNote}` : "";
    try {
        const r = await dispatchAI("plan", {
            system:
                "Return ONLY minified JSON - no prose, no code fences: " +
                '{"product":string,"tagline":string,"icp":string,"pricingUsd":int,"trialDays":int,' +
                '"stack":[string],"slices":[{"title":string,"sub":string,"doneWhen":string}],' +
                '"market":{"persona":string,"mrrLow":int,"mrrHigh":int,"wtpQuote":string,' +
                '"competitors":[{"name":string,"price":string,"weakness":string}]},' +
                '"branding":{"mark":string,"palette":[string,string],"domain":string,"style":string}}. ' +
                "product is a real, brandable company name. pricingUsd 9-299. trialDays 7-30. " +
                "4-6 slices; slices[0] is the first buildable slice. mark is ONE uppercase letter. " +
                "palette is two hex colors (e.g. #e0794c). domain like 'name.app'. 2-3 competitors. " +
                "Respect the founder's guardrails (budget, test/live, constraints) in stack + pricing.",
            prompt: `Angle: ${picked.name}\nICP: ${picked.icp}\nWedge: ${picked.wedge}\nPain: ${picked.pain}\nFounder's thought: ${thought}\nGuardrails (MUST honor): ${guardrailsText(guardrails)}${extra}\nWrite the full company spec + branding for this bet.`,
            maxTokens: 2000,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const j = extractJson(r.text);
        if (!j) return fb;
        return { spec: toSpec(j, fb.spec), branding: toBranding(j.branding, fb.branding) };
    } catch {
        return fb;
    }
}

// ---- defensive coercion: AI value → typed shape, per-field fallback ----------------------

function toCandidate(raw: unknown, fb: Candidate): Candidate | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    return {
        id: randomUUID(),
        name: str(o.name, fb.name, 48),
        icp: str(o.icp, fb.icp, 120),
        wedge: str(o.wedge, fb.wedge, 160),
        pain: str(o.pain, fb.pain, 200),
        scores: toScores(o.scores, fb.scores),
        evidence: toEvidence(o.evidence, fb.evidence),
        firstSlice: {
            title: str((o.firstSlice as Record<string, unknown>)?.title, fb.firstSlice.title, 100),
            doneWhen: str(
                (o.firstSlice as Record<string, unknown>)?.doneWhen,
                fb.firstSlice.doneWhen,
                120,
            ),
        },
    };
}

function toScores(v: unknown, fb: OppScores): OppScores {
    const o = (v ?? {}) as Record<string, unknown>;
    const out = {} as OppScores;
    for (const k of SCORE_KEYS) out[k] = clamp10(o[k], fb[k]);
    return out;
}

function toEvidence(v: unknown, fb: Evidence[]): Evidence[] {
    if (!Array.isArray(v)) return fb;
    const kinds: EvidenceKind[] = ["demand", "gap", "price"];
    const out = v
        .map((e): Evidence | null => {
            if (!e || typeof e !== "object") return null;
            const o = e as Record<string, unknown>;
            const kind = kinds.includes(o.kind as EvidenceKind)
                ? (o.kind as EvidenceKind)
                : "demand";
            const text = str(o.text, "", 200);
            if (!text) return null;
            return { kind, text, source: str(o.source, "signal", 80) };
        })
        .filter((e): e is Evidence => e !== null)
        .slice(0, 4);
    return out.length ? out : fb;
}

function toSpec(j: Record<string, unknown>, fb: CompanySpec): CompanySpec {
    const market = (j.market ?? {}) as Record<string, unknown>;
    return {
        product: str(j.product, fb.product, 48),
        tagline: str(j.tagline, fb.tagline, 120),
        icp: str(j.icp, fb.icp, 120),
        pricingUsd: clampInt(j.pricingUsd, fb.pricingUsd, 1, 999),
        trialDays: clampInt(j.trialDays, fb.trialDays, 0, 60),
        stack: toStringArr(j.stack, fb.stack, 8),
        slices: toSlices(j.slices, fb.slices),
        market: {
            persona: str(market.persona, fb.market.persona, 120),
            mrrLow: clampInt(market.mrrLow, fb.market.mrrLow, 0, 1_000_000),
            mrrHigh: clampInt(market.mrrHigh, fb.market.mrrHigh, 0, 1_000_000),
            wtpQuote: str(market.wtpQuote, fb.market.wtpQuote, 200),
            competitors: toCompetitors(market.competitors, fb.market.competitors),
        },
    };
}

function toSlices(v: unknown, fb: CompanySpec["slices"]): CompanySpec["slices"] {
    if (!Array.isArray(v)) return fb;
    const out = v
        .map((s): SpecSlice | null => {
            if (!s || typeof s !== "object") return null;
            const o = s as Record<string, unknown>;
            const title = str(o.title, "", 100);
            if (!title) return null;
            return { title, sub: str(o.sub, "", 160), doneWhen: str(o.doneWhen, "", 120) };
        })
        .filter((s): s is SpecSlice => s !== null)
        .slice(0, 8);
    return out.length ? out : fb;
}

function toCompetitors(v: unknown, fb: CompanySpec["market"]["competitors"]) {
    if (!Array.isArray(v)) return fb;
    const out = v
        .map((c) => {
            if (!c || typeof c !== "object") return null;
            const o = c as Record<string, unknown>;
            const name = str(o.name, "", 48);
            if (!name) return null;
            return {
                name,
                price: str(o.price, "-", 24),
                weakness: str(o.weakness, "", 120),
            };
        })
        .filter((c): c is CompanySpec["market"]["competitors"][number] => c !== null)
        .slice(0, 4);
    return out.length ? out : fb;
}

function toBranding(v: unknown, fb: Branding): Branding {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
        mark: markOf(o.mark, fb.mark),
        palette: toPalette(o.palette, fb.palette),
        domain: domainOf(o.domain, fb.domain),
        style: str(o.style, fb.style, 120),
    };
}

function toPalette(v: unknown, fb: [string, string]): [string, string] {
    if (Array.isArray(v)) {
        const a = hex(v[0]);
        const b = hex(v[1]);
        if (a && b) return [a, b];
    }
    return fb;
}

// ---- deterministic fallbacks (offline / parse-failure path) -------------------------------

function fallbackCandidates(thought: string): Candidate[] {
    const base = titleFromThought(thought);
    const angles: { name: string; wedge: string; bias: number }[] = [
        {
            name: `${base} Pro`,
            wedge: "The fastest path to the core outcome - nothing else.",
            bias: 1,
        },
        { name: `${base} Flow`, wedge: "Automates the busywork around it end to end.", bias: 0 },
        { name: `${base} Radar`, wedge: "Alerts the moment something needs attention.", bias: -1 },
        {
            name: `${base} Studio`,
            wedge: "A focused workspace to do the whole job in one place.",
            bias: 0,
        },
        {
            name: `${base} Copilot`,
            wedge: "An assistant that does the first draft for you.",
            bias: 1,
        },
    ];
    return angles.map((a, i) => ({
        id: randomUUID(),
        name: a.name.slice(0, 48),
        icp: "Solo operators and small teams who feel this pain weekly.",
        wedge: a.wedge,
        pain: thought.slice(0, 180) || "A recurring, unglamorous problem worth paying to remove.",
        scores: seededScores(thought + i, a.bias),
        evidence: [
            {
                kind: "demand",
                text: "People repeatedly ask for this in niche communities.",
                source: "forums",
            },
            { kind: "gap", text: "Incumbents are bloated or enterprise-priced.", source: "market" },
            { kind: "price", text: "Comparable tools charge $20-80/mo.", source: "pricing pages" },
        ],
        firstSlice: {
            title: "A visitor can sign up on a live URL",
            doneWhen: "The signup page is live and accepts an email.",
        },
    }));
}

function fallbackSpec(
    picked: Candidate,
    thought: string,
): { spec: CompanySpec; branding: Branding } {
    const product =
        picked.name.replace(/\s+(Pro|Flow|Radar|Studio|Copilot)$/i, "").trim() ||
        titleFromThought(thought);
    const palette = paletteFor(product);
    return {
        spec: {
            product,
            tagline: picked.wedge.slice(0, 80),
            icp: picked.icp,
            pricingUsd: 29,
            trialDays: 14,
            stack: ["TanStack Start", "SQLite", "Stripe", "Resend"],
            slices: [
                {
                    title: "A visitor can sign up on a live URL",
                    sub: "Landing + email capture, deployed.",
                    doneWhen: "Signup page is live and accepts an email.",
                },
                {
                    title: "Core action works end to end",
                    sub: "The one thing the product must do.",
                    doneWhen: "A user completes the core flow.",
                },
                {
                    title: "Stripe checkout live",
                    sub: "Turn a trial into a paying customer.",
                    doneWhen: "A test card can subscribe.",
                },
                {
                    title: "First retention loop",
                    sub: "A reason to come back this week.",
                    doneWhen: "A weekly email or digest sends.",
                },
            ],
            market: {
                persona: picked.icp,
                mrrLow: 500,
                mrrHigh: 4000,
                wtpQuote: '"I\'d pay for this today if it just worked."',
                competitors: [
                    { name: "Incumbent A", price: "$49/mo", weakness: "Bloated, slow onboarding." },
                    {
                        name: "DIY spreadsheet",
                        price: "free",
                        weakness: "Breaks at scale, no automation.",
                    },
                ],
            },
        },
        branding: {
            mark: (product[0] ?? "C").toUpperCase(),
            palette,
            domain: `${slugForDomain(product)}.app`,
            style: "Clean, confident, a little playful - indie SaaS.",
        },
    };
}

// ---- small pure helpers -------------------------------------------------------------------

function parseData(spin: string | null): SpinData {
    if (!spin) return {};
    try {
        const j = JSON.parse(spin);
        return j && typeof j === "object" ? (j as SpinData) : {};
    } catch {
        return {};
    }
}

function titleFromThought(thought: string): string {
    const t = thought
        .split(/\s+/)
        .slice(0, 3)
        .join(" ")
        .replace(/[^\w\s-]/g, "")
        .trim();
    return t || "Slice";
}

function slugForDomain(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")
            .slice(0, 24) || "app"
    );
}

// Deterministic 8-dim scores from a seed, nudged by `bias` so the three fallback angles
// don't look identical. Kept in 4-9 so no fallback bet reads as either garbage or a slam dunk.
function seededScores(seed: string, bias: number): OppScores {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const out = {} as OppScores;
    for (const k of SCORE_KEYS) {
        h = (h * 1103515245 + 12345) >>> 0;
        out[k] = clampN(4 + (h % 6) + bias, 3, 9);
    }
    return out;
}
function clamp10(v: unknown, fb: number): number {
    return typeof v === "number" && Number.isFinite(v) ? clampN(Math.round(v), 0, 10) : fb;
}
function clampInt(v: unknown, fb: number, lo: number, hi: number): number {
    return typeof v === "number" && Number.isFinite(v) ? clampN(Math.round(v), lo, hi) : fb;
}
function clampN(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}
function toStringArr(v: unknown, fb: string[], max: number): string[] {
    if (!Array.isArray(v)) return fb;
    const out = v
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 40))
        .slice(0, max);
    return out.length ? out : fb;
}
function markOf(v: unknown, fb: string): string {
    return typeof v === "string" && v.trim() ? v.trim()[0].toUpperCase() : fb;
}
function hex(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
}
function domainOf(v: unknown, fb: string): string {
    const s = str(v, "", 48)
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : fb;
}
