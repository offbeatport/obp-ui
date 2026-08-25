import { randomUUID } from "node:crypto";
import {
    type Branding,
    type Candidate,
    type CompanySpec,
    type Evidence,
    type EvidenceKind,
    type Guardrails,
    type OppCompetitor,
    type OppScores,
    SCORE_KEYS,
    SCORE_META,
    type ScoreKey,
    type SpecSlice,
    type SpinData,
    companySpecMd,
    gtmOutlineMd,
    guardrailsText,
    opportunitySpecFilename,
    opportunitySpecMd,
    paletteFor,
    scoreTotal,
} from "../config/spin.js";
import { sqlite } from "../db/index.js";
import { graduateCompany } from "../server/spin-logic.js";
import { extractJson, extractJsonArray, str } from "./coerce.js";
import { clip, dlog } from "./debug.js";
import { dispatchAI } from "./dispatch.js";
import { LocalGitProvider } from "./seams/git.js";
import { singleFlight } from "./single-flight.js";

// The company git backbone - used to persist each pipeline step's .md artifact onto `main`.
// Instantiated directly (like the sqlite handle above) since the spin passes run without an
// engine context. Writes happen only in the single-flighted DRAFT passes, before any run.
const git = new LocalGitProvider();

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
const WRITE_SPIN = sqlite.prepare("UPDATE company SET spin_status = ?, spin = ? WHERE id = ? AND spin_status = ?");
const FAIL_SPIN = sqlite.prepare("UPDATE company SET spin_status = 'failed' WHERE id = ? AND spin_status = ?");

// Atomic spinStatus advance: re-read the row inside the txn, bail unless it's still in `from`
// (an earlier tick / another pass may have moved it), then merge `patch` into spin + flip to
// `to`. Returns nothing; the guarded UPDATE makes a lost race a harmless no-op.
//
// `expectPickedId` (spinSpec only): also bail unless the CURRENT pick still matches the one the
// spec was drafted for. Closes the re-pick race - if the founder chose a different angle (reset
// + re-pick) while the AI ran, an in-flight spec for the old candidate must NOT overwrite it.
const advance = sqlite.transaction(
    (id: string, from: string, to: string, patch: Partial<SpinData>, expectPickedId?: string) => {
        const row = READ_STATUS.get(id) as { status: string | null; spin: string | null } | undefined;
        if (!row || row.status !== from) return;
        const current = parseData(row.spin);
        if (expectPickedId !== undefined && current.pickedId !== expectPickedId) return;
        const merged = { ...current, ...patch };
        WRITE_SPIN.run(to, JSON.stringify(merged), id, from);
    },
);

// ---- pass 1: scout - a fresh thought → 5 full, scored opportunity specs (market research) --
export async function spinScout(inflight: Set<string>): Promise<void> {
    const row = PICK_SCOUTING.get() as DraftRow | undefined;
    if (!row) return;
    await singleFlight(inflight, row.id, async () => {
        try {
            const spin = parseData(row.spin);
            dlog("spin", `scout: company ${row.id} · "${clip(row.thought, 60)}"`);
            const candidates = await scoutCandidates(row.thought, spin.guardrails, spin.criteria);
            dlog("spin", `scout: company ${row.id} → ${candidates.length} candidates → proposals`);
            // Persist the 5 full opportunity specs to git (step 1 of the pipeline) before we flip
            // to 'proposals'. Best-effort: the specs are in the DB regardless of a git failure.
            await persistOpportunities(row.id, candidates);
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
            const { spec, branding } = await draftSpecAndBranding(picked, row.thought, data.guardrails, data.editNote);
            // Persist the full company spec + GTM outline to git (steps 2 & 5 of the pipeline).
            await persistCompanySpec(row.id, spec, branding, data.guardrails);
            // Guard on the pick-time pickedId: a mid-flight re-pick (reset → pick another) must
            // discard this now-stale spec. Undefined (defensive candidates[0] fallback) → no guard.
            // Clear editNote once applied.
            advance.immediate(row.id, "specing", "spec", { spec, branding, editNote: undefined }, data.pickedId);
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
const APPLY_CHAT = sqlite.transaction((id: string, patch: Partial<SpinData>, to: string, allowed: string[]) => {
    const row = READ_STATUS.get(id) as { status: string | null; spin: string | null } | undefined;
    if (!row || !row.status || !allowed.includes(row.status)) return false;
    WRITE_SPIN.run(to, JSON.stringify({ ...parseData(row.spin), ...patch }), id, row.status);
    return true;
});

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
            dlog("spin", `chat: company ${row.id} · stage ${row.status ?? "spec"} · ${transcript.length} msgs`);
            const { reply, action } = await chatTurn(row.thought, row.status ?? "spec", data, transcript);
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
        candidates.find((c) => c.id === ref) ?? candidates.find((c) => c.name.toLowerCase().includes(s) && s.length > 1)
    );
}

async function chatTurn(
    thought: string,
    status: string,
    data: SpinData,
    transcript: ChatMsg[],
): Promise<{ reply: string; action: ChatAction }> {
    const state = describeState(thought, status, data);
    const convo = transcript.map((m) => `${m.role === "user" ? "Founder" : "You"}: ${m.content}`).join("\n");
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
                .map((c, i) => `  ${i + 1}. ${c.name} - ${c.wedge} (score ${scoreTotal(c.scores).toFixed(1)}/10)`)
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
function heuristicTurn(text: string, status: string, candidates: Candidate[]): { reply: string; action: ChatAction } {
    const t = text.toLowerCase();
    if (/\b(re-?scout|different|other ideas|another (set|angle|idea)|not these|something else)\b/.test(t)) {
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
        if (/\b(create|build|ship|make) it\b|\blet'?s (go|build|ship)\b|\bcommit\b|\bgo live\b/.test(t)) {
            return { reply: "Creating the company now.", action: { type: "commit" } };
        }
        if (/\b(cheaper|price|pricing|\$|stack|slice|drop|add|change|remove|rename|tagline|trial|target)\b/.test(t)) {
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
        const hits = name.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && text.includes(w)).length;
        if (hits > bestHits) {
            bestHits = hits;
            best = c;
        }
    }
    return bestHits > 0 ? best : undefined;
}

// ---- git persistence of the pipeline artifacts (best-effort; never blocks the flow) --------

// Step 1: write one .md per opportunity spec under slop/opportunities/ (ranked order).
async function persistOpportunities(companyId: string, candidates: Candidate[]): Promise<void> {
    try {
        const files = candidates.map((c, i) => ({
            path: `slop/opportunities/${opportunitySpecFilename(c, i + 1)}`,
            content: opportunitySpecMd(c),
        }));
        await git.writeDoc(companyId, files, `docs: ${files.length} opportunity specs (market research)`);
        dlog("spin", `scout: company ${companyId} → wrote ${files.length} opportunity spec .md`);
    } catch (e) {
        dlog("spin", `scout: company ${companyId} → .md persist skipped: ${(e as Error).message}`);
    }
}

// Steps 2 & 5: write the full company spec (slop/spec.md, replacing the seed) + the GTM
// outline (slop/gtm.md) once the picked bet has been specced.
async function persistCompanySpec(
    companyId: string,
    spec: CompanySpec,
    branding: Branding,
    guardrails?: Guardrails,
): Promise<void> {
    try {
        await git.writeDoc(
            companyId,
            [
                { path: "slop/spec.md", content: companySpecMd(spec, branding, guardrails) },
                { path: "slop/gtm.md", content: gtmOutlineMd(spec, branding) },
            ],
            "docs: company spec + GTM outline",
        );
        dlog("spin", `spec: company ${companyId} → wrote slop/spec.md + slop/gtm.md`);
    } catch (e) {
        dlog("spin", `spec: company ${companyId} → .md persist skipped: ${(e as Error).message}`);
    }
}

// ---- AI drivers (never throw - deterministic fallback) -----------------------------------

// Market research runs in TWO fast stages so no single call is big enough to time out. The old
// one-shot "return 5 FULL specs" call blew past the 90s budget every time and SILENTLY fell back
// to junk names (the founder's phrase + a suffix, e.g. "Snowflake clone Pro"). Now:
//   1. ideate  - ONE small call → 5 genuinely distinct, well-NAMED opportunity seeds (fast).
//   2. expand  - 5 PARALLEL calls, one per seed → each seed's full spec. Each is small enough to
//                finish; a failed expansion keeps the seed's real name + deterministic scores.
async function scoutCandidates(
    thought: string,
    guardrails: Guardrails | undefined,
    criteria?: string,
): Promise<Candidate[]> {
    const seeds = await ideateOpportunities(thought, guardrails, criteria);
    if (seeds.length === 0) {
        dlog("spin", "market: ideation failed → deterministic fallback");
        return fallbackCandidates(thought); // ideation itself failed → deterministic fallback
    }
    dlog("spin", `market: ideated ${seeds.length} seed(s) → expanding in parallel`);
    const specs = await Promise.all(seeds.map((seed, i) => expandOpportunity(seed, thought, guardrails, i)));
    // Rank by overall score (best bet first) - the UI leads with the strongest candidate.
    return specs.sort((a, b) => scoreTotal(b.scores) - scoreTotal(a.scores));
}

// One tight seed: a real, well-named opportunity angle. `title` is the product NAME and must
// never echo the founder's words - the ideation prompt enforces that hard.
type Seed = { title: string; wedge: string; icp: string; pain: string; whyNow?: string };

// The Stage-1 ideation system prompt. Chosen by a judge-panel workflow (4 designs → role-played
// sample outputs on real thoughts → 2 skeptical judges each; this "few-shot + reframe + self-
// rubric" design won 7.9/10 for genuine, distinct, non-echoing names). The REFRAME + worked
// examples are what turn "Snowflake clone" into Floe/Parquet/Cairn rather than "Snowflake Pro".
const IDEATE_SYSTEM = `You are a world-class startup namer and market-research strategist. From a founder's raw, often-vague thought you invent FIVE genuinely different, real, solo-buildable SaaS opportunities - each with a brandable, startup-grade product name.

This is the IDEATION stage. Naming, distinctness, and genuineness are EVERYTHING here. You output only compact SEEDS; a later stage fleshes each one out. Keep the output small, sharp, and fast.

## WHAT YOU RETURN
ONLY a minified JSON array of EXACTLY 5 objects. No prose, no explanation, no markdown, no code fences. The response MUST start with \`[\` and end with \`]\`.
Each object has EXACTLY these keys, in this order:
{"title":string,"wedge":string,"icp":string,"pain":string,"whyNow":string}
- title: the product name - a real, brandable startup name (see NAMING RULES). This is what you are judged on.
- wedge: the one sharp insight/angle this bet wins on (<= 18 words).
- icp: the specific buyer - role + context, someone reachable who has budget (<= 16 words).
- pain: one concrete, currently-felt problem, phrased like you overheard the buyer say it (<= 24 words).
- whyNow: why this window opened recently - a real 2024-2026 shift (<= 20 words).

## REFRAME FIRST
A raw thought is a DOMAIN, not a spec. Many thoughts (e.g. "Snowflake clone") name something no solo founder can build. Do NOT try to clone the giant. Mine the domain for five ADJACENT, solo-buildable jobs around it: tools for its users, its cost, its gaps, its migrations, the workflows it ignores. Reinterpret boldly - the founder wants opportunities, not a literal rebuild.

## NAMING RULES (a title that breaks ANY rule is INVALID - rename it)
1. Never reuse, echo, translate, or lightly modify the founder's words. For "Snowflake clone", the words "Snowflake", "Snow*", and "Clone" are all BANNED in the name.
2. Never = the founder's phrase + a generic affix. BANNED affixes: Pro, Hub, AI, Flow, App, Cloud, Kit, Labs, HQ, Go, ly, ify, Sync, Suite, Now, -er.
3. Never a plain dictionary category ("Data Warehouse", "Resume Builder"). A name is a brand, not a description.
4. Prefer: a real evocative word used sideways (Floe, Parquet, Cairn), a short coined word / portmanteau, or a crisp metaphor. 1-2 words, ideally <= 12 characters, easy to say, .com-plausible.
5. All 5 names must be unrelated to each other - not five variations on one root word.

FORBIDDEN OUTPUT (this is the exact garbage we are replacing - never produce anything resembling it):
For "Snowflake clone" -> "Snowflake Clone Pro", "Snowflake Flow", "Snowflake Radar", "Snowflake Studio", "Snowflake Copilot". All five are auto-rejected on Rule 1 and Rule 2.

## DISTINCTNESS
The 5 must attack different ANGLES: a different buyer, OR a different job, OR a different wedge. Two seeds one product could serve = failure; replace one. Aim to span roughly: cost/efficiency, a lighter alternative, an adjacent gap the incumbent leaves open, a workflow the incumbent ignores, and distribution/exit.

## SELF-SCORING RUBRIC (apply SILENTLY before answering - do NOT output scores)
For each seed check: (a) NAME passes all 5 naming rules; (b) DISTINCT from the other four; (c) REAL - the pain is specific and someone would pay to remove it, not "saves time"; (d) BUILDABLE - a solo dev ships v1 in weeks, software-only (no hardware, no capital-heavy infra); (e) BUYER - the icp is reachable and has budget (B2B/prosumer beats free consumer). If any seed fails, fix or replace it and re-check. Emit only when all 5 pass.

## GUARDRAILS
Honor the founder's guardrails literally (budget, test-mode, banned industries, target segment). If they say "avoid regulated industries", steer clear of health, lending, and anything license-gated.

## WORKED EXAMPLES (study the naming and the spread of angles)

EXAMPLE A
Thought: "Snowflake clone"
Guardrails: budget <= $500/mo; test-mode (no real charges yet); avoid regulated industries
Output:
[{"title":"Floe","wedge":"Real-time spend-anomaly alerts pinned to the exact query and the engineer who ran it","icp":"Data engineers at Series-A startups on Snowflake","pain":"One runaway query quietly burns $40k overnight and finance finds it before we do","whyNow":"Consumption pricing plus the 2024 cost crackdown made every data team spend-paranoid"},{"title":"Parquet","wedge":"A zero-idle-cost warehouse over your object storage that sleeps when nobody is querying","icp":"Ops-heavy teams under 15 people sitting on under a terabyte","pain":"We need SQL analytics but Snowflake is priced and shaped for a data org we do not have","whyNow":"DuckDB plus cheap object storage make a real sub-terabyte warehouse buildable by one person"},{"title":"Cairn","wedge":"An always-fresh data catalog and column lineage generated straight from your dbt manifest","icp":"Solo analytics engineers who own a sprawling dbt project alone","pain":"Every what-does-this-column-mean question routes to me because nothing is documented","whyNow":"dbt won the transform layer but deliberately leaves the documentation gap unfilled"},{"title":"Sprig","wedge":"One-command masked, sampled data branches for testing that expire on their own","icp":"Dev teams needing realistic throwaway copies of production data","pain":"Testing a migration means risky prod access or stale hand-built fixtures","whyNow":"Privacy rules made copying prod to dev a liability that masked sampling now removes"},{"title":"Portage","wedge":"Automated SQL-dialect translation plus a report that scopes your warehouse exit in an hour","icp":"Teams actively trying to leave Snowflake for Postgres or DuckDB","pain":"Our UDFs and pipelines are welded to Snowflake so leaving feels like a scary rewrite","whyNow":"The 2024-25 bill backlash created a real wave of teams shopping for the exit"}]

EXAMPLE B
Thought: "AI resume builder"
Guardrails: budget <= $500/mo; test-mode (no real charges yet); avoid regulated industries
Output:
[{"title":"Keyhole","wedge":"Reverse-engineers each posting's keyword weighting and scores you pass/fail before you apply","icp":"High-volume applicants: new grads and career-switchers","pain":"The ATS auto-rejects me on missing keywords before any human ever reads it","whyNow":"AI screening turned keyword coverage into the real 2025 hiring gate"},{"title":"Greenroom","wedge":"Builds a mock interview from your real resume and the target job, then grades spoken answers","icp":"Candidates prepping for a specific onsite next week","pain":"Generic prep lists do not match the stories on my resume or this exact role","whyNow":"Cheap speech models make realistic spoken mock interviews solo-buildable"},{"title":"Byline","wedge":"Rewrites your LinkedIn from a list of duties into quantified, recruiter-magnet narrative","icp":"Consultants and job-seeking execs who rely on inbound","pain":"My profile reads like a job description so recruiters scroll right past","whyNow":"Recruiters now source AI-first, rewarding outcome-led profiles over duty lists"},{"title":"Casebook","wedge":"Turns rough project notes into a hosted, recruiter-ready case-study site in minutes","icp":"Designers and PMs whose real resume is a portfolio","pain":"Building a case-study site eats a weekend so I keep sending a stale PDF","whyNow":"Cheap generation plus one-click hosting collapse a weekend of work into minutes"},{"title":"Vouch","wedge":"Maps your second-degree network to a target company and drafts the warm intro ask","icp":"Job-seekers who know cold applications do not convert","pain":"Applications into the void convert at two percent and I do not know who can refer me","whyNow":"Public graph data plus AI drafting make warm-intro routing a one-person product"}]

Now do the same for the founder's thought. If it happens to match a worked example above, invent ENTIRELY FRESH names and angles - never reuse the example's titles. Return ONLY the minified JSON array.`;

// The Stage-2 per-seed expansion system prompt (same workflow winner). Honest scoring, no
// fabricated citations, and the seed's name/identity is preserved verbatim.
const EXPAND_SYSTEM = `You are a market-research analyst. You are given ONE opportunity seed (title, wedge, icp, pain, whyNow) plus the founder's original thought and guardrails. Expand THIS ONE seed into a full, honest opportunity spec a solo founder could act on.

## HARD RULES
- Keep the seed's \`title\` EXACTLY as given - never rename, never append a suffix (Pro/Hub/AI/Flow/etc.). The name is final and was chosen deliberately.
- Preserve the seed's icp, wedge, pain, and whyNow (you may tighten the wording, never change the meaning).
- Honor the guardrails literally (budget, test-mode, banned industries, target segment).
- Be concrete and truthful. No hype, no invented statistics-as-fact. Evidence is plausible signal you could go verify, never a fabricated citation or fake URL.
- Score honestly. Not everything is a 9; a real spec has weak dimensions.

## WHAT YOU RETURN
ONLY a minified JSON object - no prose, no markdown, no code fences. It MUST start with \`{\` and end with \`}\`. Keys (exactly these):
{"title":string,"description":string,"pain":string,"icp":string,"wedge":string,"whyBuy":string,"whyNow":string,"risk":string,"distribution":string,"mrr":{"low":int,"high":int,"basis":string},"scores":{"buyer":int,"pain":int,"wtp":int,"timing":int,"build":int,"legal":int,"distro":int,"pricing":int},"scoreWhy":{"buyer":string,"pain":string,"wtp":string,"timing":string,"build":string,"legal":string,"distro":string,"pricing":string},"competitors":[{"tool":string,"whyPay":string,"gap":string}],"evidence":[{"kind":"demand"|"gap"|"price","text":string,"source":string}],"firstSlice":{"title":string,"doneWhen":string}}

## FIELD RULES
- description: 2-3 sentences stating the bet.
- whyBuy: why this exact buyer pays, in money or time terms.
- risk: the single biggest thing that could kill it.
- distribution: the concrete first channel to reach the icp (a named community/forum/segment), not "social media".
- mrr: realistic monthly recurring revenue in USD as low/high, with a one-line basis (e.g. "~120 users x $39/mo").
- scores: integers 0-10 on - buyer (reachable buyer), pain (urgency), wtp (willingness to pay), timing (why now), build (solo-shippable, software-only), legal (regulatory/liability safety), distro (you can reach them), pricing (pricing ceiling).
- scoreWhy: one short line justifying EACH of the 8 scores (why that number).
- competitors: 2-3 rows - tool = how buyers solve it today (include the DIY/spreadsheet/manual option), whyPay = why that works for them today, gap = the specific weakness this bet wins on.
- evidence: 2-3 items - kind is "demand", "gap", or "price"; text is the signal; source is where you would observe it (a named community, a pricing page, a forum), never a fabricated statistic or link.
- firstSlice: the smallest live, testable slice - keep it shippable as a signup-capable landing page. title = the user-facing outcome; doneWhen = the observable pass condition.

Return the JSON object only.`;

// Stage 1 - fast ideation. Small output → completes well inside the timeout. Returns [] on any
// failure (the caller then falls back deterministically).
async function ideateOpportunities(
    thought: string,
    guardrails: Guardrails | undefined,
    criteria?: string,
): Promise<Seed[]> {
    const extra = criteria ? `\nExtra criteria the founder requires (MUST honor): ${criteria}` : "";
    try {
        const r = await dispatchAI("market", {
            system: IDEATE_SYSTEM,
            prompt: `Founder's raw thought: ${thought}\nGuardrails (MUST honor): ${guardrailsText(guardrails)}${extra}\n\nReframe the thought into a domain, then invent 5 seeds per your rules - brilliantly named, genuinely distinct, real, solo-buildable, and honoring the guardrails. Apply the self-scoring rubric silently.\nReturn ONLY the minified JSON array of 5 objects: starts with [ , ends with ] , nothing before or after.`,
            maxTokens: 1800,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        return extractJsonArray(r.text)
            .map((raw): Seed | null => {
                if (!raw || typeof raw !== "object") return null;
                const o = raw as Record<string, unknown>;
                const title = str(o.title ?? o.name, "", 48);
                if (!title) return null;
                return {
                    title,
                    wedge: str(o.wedge, "", 220),
                    icp: str(o.icp, "", 160),
                    pain: str(o.pain, "", 240),
                    whyNow: str(o.whyNow, "", 240) || undefined,
                };
            })
            .filter((s): s is Seed => s !== null)
            .slice(0, 5);
    } catch {
        return [];
    }
}

// Stage 2 - expand ONE seed into a full opportunity spec. Best-effort + never throws: on any
// failure it returns a "light" candidate that KEEPS the seed's real name/wedge/ICP/pain and gives
// it deterministic scores, so the founder always sees a genuinely-named opportunity.
async function expandOpportunity(
    seed: Seed,
    thought: string,
    guardrails: Guardrails | undefined,
    idx: number,
): Promise<Candidate> {
    const light = lightCandidateFromSeed(seed, thought, idx);
    try {
        const r = await dispatchAI("market", {
            system: EXPAND_SYSTEM,
            prompt: `Opportunity seed to expand (keep this identity):\n- title: ${seed.title}\n- wedge: ${seed.wedge}\n- icp: ${seed.icp}\n- pain: ${seed.pain}\n${seed.whyNow ? `- whyNow: ${seed.whyNow}\n` : ""}Founder's original thought: ${thought}\nGuardrails (MUST honor): ${guardrailsText(guardrails)}\nExpand this ONE seed into the full spec.`,
            maxTokens: 1600,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        const j = extractJson(r.text);
        if (!j) return light;
        // The AI's detail wins, but the seed's identity (name/wedge/ICP/pain) is LOCKED so a
        // sloppy expansion can't rename or drift the opportunity the founder is about to see.
        return (
            toCandidate({ ...j, title: seed.title, wedge: seed.wedge, icp: seed.icp, pain: seed.pain }, light) ?? light
        );
    } catch {
        return light;
    }
}

// A real-but-un-enriched candidate straight from a seed (expansion offline/failed). Keeps the
// genuine name; deterministic scores + justifications so it still ranks + renders.
function lightCandidateFromSeed(seed: Seed, thought: string, idx: number): Candidate {
    const scores = seededScores(seed.title + thought + idx, 0);
    return {
        id: randomUUID(),
        name: seed.title,
        icp: seed.icp || "A specific, reachable buyer who feels this pain weekly.",
        wedge: seed.wedge || "A focused wedge into the problem.",
        pain: seed.pain || thought.slice(0, 180),
        scores,
        evidence: [],
        firstSlice: {
            title: "A visitor can sign up on a live URL",
            doneWhen: "The signup page is live and accepts an email.",
        },
        description: `${seed.title}: ${seed.wedge}`.slice(0, 600),
        whyNow: seed.whyNow,
        scoreWhy: Object.fromEntries(
            SCORE_KEYS.map((k) => [k, `${SCORE_META[k].full}: ${scores[k]}/10 on ${SCORE_META[k].hint}.`]),
        ) as Partial<Record<ScoreKey, string>>,
    };
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
    const slice = (o.firstSlice ?? {}) as Record<string, unknown>;
    return {
        id: randomUUID(),
        // accept "title" (new full-spec key) or legacy "name"
        name: str(o.title ?? o.name, fb.name, 48),
        icp: str(o.icp, fb.icp, 120),
        wedge: str(o.wedge, fb.wedge, 160),
        pain: str(o.pain, fb.pain, 200),
        scores: toScores(o.scores, fb.scores),
        evidence: toEvidence(o.evidence, fb.evidence),
        firstSlice: {
            title: str(slice.title, fb.firstSlice.title, 100),
            doneWhen: str(slice.doneWhen, fb.firstSlice.doneWhen, 120),
        },
        // ---- full-spec fields (undefined when the model omits them → per-field fallback) ----
        description: str(o.description, fb.description ?? "", 600) || undefined,
        whyBuy: str(o.whyBuy, fb.whyBuy ?? "", 400) || undefined,
        whyNow: str(o.whyNow, fb.whyNow ?? "", 400) || undefined,
        risk: str(o.risk, fb.risk ?? "", 400) || undefined,
        distribution: str(o.distribution, fb.distribution ?? "", 400) || undefined,
        mrr: toMrr(o.mrr, fb.mrr),
        scoreWhy: toScoreWhy(o.scoreWhy, fb.scoreWhy),
        competitors: toOppCompetitors(o.competitors, fb.competitors),
    };
}

// Per-signal justification map (scoreWhy). Keep only the 8 known keys; fall back per-key.
function toScoreWhy(v: unknown, fb?: Partial<Record<ScoreKey, string>>): Partial<Record<ScoreKey, string>> | undefined {
    const o = (v ?? {}) as Record<string, unknown>;
    const out: Partial<Record<ScoreKey, string>> = {};
    for (const k of SCORE_KEYS) {
        const s = str(o[k], fb?.[k] ?? "", 240);
        if (s) out[k] = s;
    }
    return Object.keys(out).length ? out : fb;
}

function toMrr(
    v: unknown,
    fb?: { low: number; high: number; basis: string },
): { low: number; high: number; basis: string } | undefined {
    if (!v || typeof v !== "object") return fb;
    const o = v as Record<string, unknown>;
    const low = clampInt(o.low, fb?.low ?? 0, 0, 10_000_000);
    const high = clampInt(o.high, fb?.high ?? 0, 0, 10_000_000);
    const basis = str(o.basis, fb?.basis ?? "", 240);
    if (!low && !high && !basis) return fb;
    return { low, high: Math.max(low, high), basis };
}

function toOppCompetitors(v: unknown, fb?: OppCompetitor[]): OppCompetitor[] | undefined {
    if (!Array.isArray(v)) return fb;
    const out = v
        .map((c): OppCompetitor | null => {
            if (!c || typeof c !== "object") return null;
            const o = c as Record<string, unknown>;
            const tool = str(o.tool ?? o.name, "", 60);
            if (!tool) return null;
            return { tool, whyPay: str(o.whyPay, "", 200), gap: str(o.gap ?? o.weakness, "", 200) };
        })
        .filter((c): c is OppCompetitor => c !== null)
        .slice(0, 4);
    return out.length ? out : fb;
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
            const kind = kinds.includes(o.kind as EvidenceKind) ? (o.kind as EvidenceKind) : "demand";
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

// Brandable names for the deterministic fallback - clean, real-sounding, and (crucially) NOT
// the founder's phrase + a suffix. Picked by a seeded stride so a thought gets a stable set.
const FALLBACK_NAMES = [
    "Northwind",
    "Cinch",
    "Ledgerly",
    "Fathom",
    "Tally",
    "Beacon",
    "Cobalt",
    "Quill",
    "Cadence",
    "Relay",
    "Vantage",
    "Drift",
    "Anchor",
    "Lumen",
    "Forge",
    "Slate",
    "Nimbus",
    "Orbit",
    "Harbor",
    "Method",
    "Cove",
    "Ember",
    "Kite",
    "Pace",
];
function fallbackNames(seed: string, n: number): string[] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const start = h % FALLBACK_NAMES.length;
    return Array.from({ length: n }, (_, i) => FALLBACK_NAMES[(start + i * 5) % FALLBACK_NAMES.length]);
}

function fallbackCandidates(thought: string): Candidate[] {
    const angles: { wedge: string; bias: number }[] = [
        { wedge: "The fastest path to the core outcome - nothing else.", bias: 1 },
        { wedge: "Automates the busywork around it end to end.", bias: 0 },
        { wedge: "Alerts the moment something needs attention.", bias: -1 },
        { wedge: "A focused workspace to do the whole job in one place.", bias: 0 },
        { wedge: "An assistant that drafts the first version for you.", bias: 1 },
    ];
    const names = fallbackNames(thought, angles.length);
    const pain = thought.slice(0, 180) || "A recurring, unglamorous problem worth paying to remove.";
    return angles.map((a, i) => {
        const scores = seededScores(thought + i, a.bias);
        const name = names[i];
        return {
            id: randomUUID(),
            name,
            icp: "Solo operators and small teams who feel this pain weekly.",
            wedge: a.wedge,
            pain,
            scores,
            evidence: [
                {
                    kind: "demand" as const,
                    text: "People repeatedly ask for this in niche communities.",
                    source: "forums",
                },
                {
                    kind: "gap" as const,
                    text: "Incumbents are bloated or enterprise-priced.",
                    source: "market",
                },
                {
                    kind: "price" as const,
                    text: "Comparable tools charge $20-80/mo.",
                    source: "pricing pages",
                },
            ],
            firstSlice: {
                title: "A visitor can sign up on a live URL",
                doneWhen: "The signup page is live and accepts an email.",
            },
            // full-spec detail so an offline scan still yields readable specs + .md files
            description: `${name}: ${a.wedge} Aimed at people who hit "${pain}" often enough to pay to make it go away.`,
            whyBuy: "It removes a weekly, manual chore for less than the time it costs them.",
            whyNow: "Cheap AI + no-code plumbing make this shippable by one person for the first time.",
            risk: "Demand may be shallow - validate that people will pay before over-building.",
            distribution: "Post where the buyer already complains: niche subreddits, Slack/Discord, forums.",
            mrr: { low: 500, high: 4000, basis: "≈50-200 users at $20-40/mo" },
            scoreWhy: Object.fromEntries(
                SCORE_KEYS.map((k) => [k, `${SCORE_META[k].full}: scored ${scores[k]}/10 on ${SCORE_META[k].hint}.`]),
            ) as Partial<Record<ScoreKey, string>>,
            competitors: [
                {
                    tool: "An incumbent SaaS",
                    whyPay: "It's the known, trusted default.",
                    gap: "Bloated, slow, and priced for teams not solo buyers.",
                },
                {
                    tool: "A DIY spreadsheet / manual process",
                    whyPay: "Free and infinitely flexible.",
                    gap: "Breaks at scale, no automation, easy to forget.",
                },
            ],
        };
    });
}

function fallbackSpec(picked: Candidate, thought: string): { spec: CompanySpec; branding: Branding } {
    const product = picked.name.replace(/\s+(Pro|Flow|Radar|Studio|Copilot)$/i, "").trim() || titleFromThought(thought);
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
