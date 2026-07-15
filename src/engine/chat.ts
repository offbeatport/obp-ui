import { randomUUID } from "node:crypto";
import { sqlite } from "../db/index.js";
import { dispatchAI } from "./dispatch.js";
import { singleFlight } from "./single-flight.js";

// chat.ts - the engine pass that answers a user turn in a company's co-pilot chat. Design
// notes (grounded in the pre-impl critique):
//   • SCOPED companies only (must have a scope.done marker) → never races/duplicates
//     scope.ts's founding narration; the founding thought is scope's, not chat's.
//   • "Unanswered user" = a user turn that is the LAST user-or-assistant message (rowid
//     tiebreak survives same-ms inserts); system ship-notices don't count. Keying off "no
//     later user OR assistant" (see LAST_NON_SYSTEM) means a follow-up sent mid-reply is
//     answered next tick with full context rather than silently swallowed.
//   • company_id IS NOT NULL excludes global chats.
//   • ONE company per tick (bounded fan-out). ALWAYS inserts a reply (deterministic
//     fallback on AI error) so a message is never left pending → no 1Hz claude spawn storm.
//   • dispatchAI runs OUTSIDE the txn under an AbortSignal timeout.

const DISPATCH_MS = 90_000;

// A user turn is answerable iff it is the LAST user-or-assistant message in a scoped company
// (system ship-notices don't count, so they neither suppress nor get re-answered). Keying off
// "no later user OR assistant message" (not just assistant) means a follow-up the founder
// sends while a reply is in flight makes the earlier turn no longer answerable - the in-flight
// reply is then dropped by STILL_UNANSWERED and the newer turn is answered next tick WITH the
// full transcript, so no message is ever silently swallowed.
const LAST_NON_SYSTEM = `
  NOT EXISTS (
    SELECT 1 FROM message x
    WHERE x.company_id = m.company_id AND x.role IN ('user','assistant')
      AND (x.created_at, x.rowid) > (m.created_at, m.rowid)
  )`;
// A few candidate companies (at most one pending turn each) so answerNext can skip any that
// are already in flight - one company's slow dispatch never head-of-line-blocks the others.
const PICK = sqlite.prepare(`
  SELECT m.company_id AS companyId, m.id AS msgId
  FROM message m
  WHERE m.company_id IS NOT NULL
    AND m.role = 'user'
    AND EXISTS (
      SELECT 1 FROM app_config a
      WHERE a.scope = 'global' AND a.key = 'scope.done.' || m.company_id
    )
    AND ${LAST_NON_SYSTEM}
  ORDER BY m.created_at DESC, m.rowid DESC
  LIMIT 8
`);
const STILL_UNANSWERED = sqlite.prepare(
    `SELECT 1 FROM message m WHERE m.id = ? AND ${LAST_NON_SYSTEM}`,
);
const GET_THESIS = sqlite.prepare("SELECT thesis FROM company WHERE id = ?");
const RECENT = sqlite.prepare(
    "SELECT role, content FROM message WHERE company_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 12",
);
const INS_REPLY = sqlite.prepare(
    "INSERT INTO message (id, company_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
);

// Guarded insert - only replies if the target turn is STILL unanswered (a second reply for
// the same turn is a harmless no-op if two ticks ever overlap).
const reply = sqlite.transaction((companyId: string, msgId: string, text: string) => {
    if (!STILL_UNANSWERED.get(msgId)) return;
    INS_REPLY.run(randomUUID(), companyId, text, Date.now());
});

export async function answerNext(inflight: Set<string>): Promise<void> {
    const rows = PICK.all() as { companyId: string; msgId: string }[];
    const row = rows.find((r) => !inflight.has(r.companyId));
    if (!row) return;
    await singleFlight(inflight, row.companyId, async () => {
        try {
            const text = await answer(row.companyId);
            // .immediate() + catch: the guarded insert is atomic and idempotent, so a transient
            // SQLITE_BUSY under web contention is swallowed and the turn is retried next tick
            // (matches scopeNext/claimNext) instead of surfacing as an unhandledRejection.
            reply.immediate(row.companyId, row.msgId, text);
        } catch {
            /* transient DB busy or dispatch hiccup - next tick re-picks the turn */
        }
    });
}

async function answer(companyId: string): Promise<string> {
    const fb = "On it - I'll fold that into the next slice and report back here.";
    const thesis = (GET_THESIS.get(companyId) as { thesis: string } | undefined)?.thesis ?? "";
    const recent = (RECENT.all(companyId) as { role: string; content: string }[]).reverse();
    const transcript = recent.map((m) => `${m.role}: ${m.content}`).join("\n");
    try {
        const r = await dispatchAI("chat", {
            system: "You are the co-pilot agent running this company. Reply in 1-3 short, concrete, action-oriented sentences. No preamble.",
            prompt: `Company thesis: ${thesis}\n\nConversation so far:\n${transcript}\n\nReply to the latest user message.`,
            maxTokens: 400,
            signal: AbortSignal.timeout(DISPATCH_MS),
        });
        return r.text.trim() || fb;
    } catch {
        return fb; // ALWAYS leave a reply - never leave the turn pending.
    }
}
