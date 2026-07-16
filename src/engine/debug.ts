// Engine debug logging — OFF by default (zero overhead), gated by the CSLOP_DEBUG env var:
//   CSLOP_DEBUG=1        one-line summaries (which pass/model ran, timing, sizes, cost)
//   CSLOP_DEBUG=verbose  the above PLUS the full prompts + responses (very noisy)
// Runs in the executor process, so `CSLOP_DEBUG=verbose pnpm dev` streams it to that terminal.
const LEVEL = process.env.CSLOP_DEBUG ?? "";
export const DEBUG = LEVEL === "1" || LEVEL === "true" || LEVEL === "verbose";
export const VERBOSE = LEVEL === "verbose";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// One-line trace, e.g. dlog("ai", "→ research via claude-cli:sonnet (prompt 812c)").
export function dlog(scope: string, msg: string): void {
    if (!DEBUG) return;
    console.log(`${DIM}[dbg ${scope}]${RESET} ${msg}`);
}

// A full-text block (prompts / responses) — only in verbose mode.
export function dblock(scope: string, label: string, body: string): void {
    if (!VERBOSE) return;
    console.log(
        `${DIM}[dbg ${scope}] ${label} ⌄${RESET}\n${body}\n${DIM}[dbg ${scope}] ${label} ⌃${RESET}`,
    );
}

// Truncate a long string for a one-line summary.
export function clip(s: string, n = 200): string {
    return s.length > n ? `${s.slice(0, n)}…(+${s.length - n}c)` : s;
}
