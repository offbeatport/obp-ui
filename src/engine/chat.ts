import { randomUUID } from "node:crypto";
import { sqlite } from "../db/index.js";
import { dispatchAI } from "./dispatch.js";

// chat.ts — the engine pass that answers a user turn in a company's co-pilot chat. Design
// notes (grounded in the pre-impl critique):
//   • SCOPED companies only (must have a scope.done marker) → never races/duplicates
//     scope.ts's founding narration; the founding thought is scope's, not chat's.
//   • "Unanswered user" = a user message with NO assistant message strictly after it by
//     (created_at, rowid) — the rowid tiebreak survives same-millisecond inserts, and
//     system messages (ship notices) do NOT count as a reply / do NOT suppress the trigger.
//   • company_id IS NOT NULL excludes global chats.
//   • ONE company per tick (bounded fan-out). ALWAYS inserts a reply (deterministic
//     fallback on AI error) so a message is never left pending → no 1Hz claude spawn storm.
//   • dispatchAI runs OUTSIDE the txn under an AbortSignal timeout.

const DISPATCH_MS = 90_000;

// Oldest unanswered user turn in a scoped company.
const PICK = sqlite.prepare(`
  SELECT m.company_id AS companyId, m.id AS msgId
  FROM message m
  WHERE m.company_id IS NOT NULL
    AND m.role = 'user'
    AND EXISTS (
      SELECT 1 FROM app_config a
      WHERE a.scope = 'global' AND a.key = 'scope.done.' || m.company_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM message r
      WHERE r.company_id = m.company_id AND r.role = 'assistant'
        AND (r.created_at, r.rowid) > (m.created_at, m.rowid)
    )
  ORDER BY m.created_at ASC, m.rowid ASC
  LIMIT 1
`);
const STILL_UNANSWERED = sqlite.prepare(`
  SELECT 1 FROM message m
  WHERE m.id = ? AND NOT EXISTS (
    SELECT 1 FROM message r
    WHERE r.company_id = m.company_id AND r.role = 'assistant'
      AND (r.created_at, r.rowid) > (m.created_at, m.rowid)
  )
`);
const GET_THESIS = sqlite.prepare("SELECT thesis FROM company WHERE id = ?");
const RECENT = sqlite.prepare(
    "SELECT role, content FROM message WHERE company_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 12",
);
const INS_REPLY = sqlite.prepare(
    "INSERT INTO message (id, company_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)",
);

// Guarded insert — only replies if the target turn is STILL unanswered (a second reply for
// the same turn is a harmless no-op if two ticks ever overlap).
const reply = sqlite.transaction((companyId: string, msgId: string, text: string) => {
    if (!STILL_UNANSWERED.get(msgId)) return;
    INS_REPLY.run(randomUUID(), companyId, text, Date.now());
});

export async function answerNext(inflight: Set<string>): Promise<void> {
    const row = PICK.get() as { companyId: string; msgId: string } | undefined;
    if (!row || inflight.has(row.companyId)) return;
    inflight.add(row.companyId);
    try {
        reply(row.companyId, row.msgId, await answer(row.companyId));
    } finally {
        inflight.delete(row.companyId);
    }
}

async function answer(companyId: string): Promise<string> {
    const fb = "On it — I'll fold that into the next slice and report back here.";
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
        return fb; // ALWAYS leave a reply — never leave the turn pending.
    }
}
