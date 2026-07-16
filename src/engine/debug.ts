// Engine debug logging — OFF by default (zero overhead), gated by the CSLOP_DEBUG env var:
//   CSLOP_DEBUG=1        one-line summaries (which pass/model ran, route, timing, sizes, cost)
//   CSLOP_DEBUG=prompts  the above PLUS the FULL prompt sent to the model (thinking + build)
//   CSLOP_DEBUG=verbose  the above PLUS the full responses too (noisiest)
// Runs in the executor process, so `CSLOP_DEBUG=prompts pnpm dev` streams it to that terminal.
export const LEVEL = (process.env.CSLOP_DEBUG ?? "").toLowerCase();
export const DEBUG =
    LEVEL === "1" || LEVEL === "true" || LEVEL === "prompts" || LEVEL === "verbose";
// Dump the exact prompt we SEND to the model.
export const PROMPTS = LEVEL === "prompts" || LEVEL === "verbose";
// Also dump the full response we GET back.
export const VERBOSE = LEVEL === "verbose";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function block(scope: string, label: string, body: string): void {
    console.log(
        `${DIM}[dbg ${scope}] ${label} ⌄${RESET}\n${body}\n${DIM}[dbg ${scope}] ${label} ⌃${RESET}`,
    );
}

// One-line trace, e.g. dlog("ai", "→ research via claude-cli:sonnet (prompt 812c)").
export function dlog(scope: string, msg: string): void {
    if (!DEBUG) return;
    console.log(`${DIM}[dbg ${scope}]${RESET} ${msg}`);
}

// The full prompt we SEND (system / user) — shown at `prompts` and `verbose`.
export function dprompt(scope: string, label: string, body: string): void {
    if (!PROMPTS) return;
    block(scope, label, body);
}

// A full response we GET back — only in `verbose` (the noisiest).
export function dblock(scope: string, label: string, body: string): void {
    if (!VERBOSE) return;
    block(scope, label, body);
}

// Truncate a long string for a one-line summary.
export function clip(s: string, n = 200): string {
    return s.length > n ? `${s.slice(0, n)}…(+${s.length - n}c)` : s;
}
