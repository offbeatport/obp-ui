# Runbook

## Dev - run the two-process spine

```sh
pnpm dev          # web (vite :3000) + executor daemon (tsx) together
# or separately, to restart the engine independently:
pnpm dev:web
pnpm dev:engine
```

Open http://localhost:3000 (Home) · `/queue` (Action Queue demo) · `/design` (design system).

## Screenshots (self-check the UI)

```sh
node scripts/shot.mjs /design dark /tmp/out.png   # <path> <light|dark> <outfile>
```

## Real build run (step 4 - the first time claude actually builds)

The executor defaults to the **NoopHarness** (no AI). To build for real:

1. **Have `claude` installed + logged in** on this host (Max/Pro subscription is fine -
   that's "subscription" credential mode; the budget cap is informational under it).
   For metered spend instead, set `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`) in `.env`.
2. Start the engine with the real harness:
    ```sh
    CSLOP_HARNESS=claude pnpm dev:engine    # (keep pnpm dev:web running in another shell)
    ```
3. Enqueue a `code` action (via the UI, or insert a company + queued action).
4. Watch it: the executor runs `claude -p` **inside the company's git worktree**
   (`companies/<companyId>/`, gitignored), streams stream-json → the run log (SSE, visible
   in `/queue`), and on success **commits a checkpoint** on a `run/<runId>` branch.

**What's NOT built yet (steps 5–7):** deploy → distinct HTTP validation → approval gate →
`Git.promote`. Until then a real build lands as `done` **without validation** - so keep
autopilot off and treat these runs as unproven. This is the next work.

### Reliability target (before widening)

Once deploy+validate exist, the bar is **cold-run ≈≥7/10 over ~10 runs** for the hardcoded
"a visitor can sign up on a live URL" action. Expect prompt-tuning between rounds.

## Credentials (`.env`, see `.env.example`)

- `CSLOP_HARNESS=claude` - opt into the real builder (default: NoopHarness).
- `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` - set either → "apikey" mode (real $ metering).
  Unset → "subscription" mode (host `claude` login).
- `OPENROUTER_API_KEY` - default AI proxy for the _thinking_ tasks (scoring/planning), later.
- `STRIPE_TEST_SECRET_KEY` - Stripe **test-mode** for the monetize action, later.

## Debugging the engine (what the AI is doing)

The executor is quiet by default. To trace what the engine calls and with what messages, set
`CSLOP_DEBUG` on the engine process (it prints to that terminal - server-side, not the UI):

```
CSLOP_DEBUG=1 pnpm dev        # one-line trace: passes (scout/spec/chat/run), model route, timing, size, cost
CSLOP_DEBUG=prompts pnpm dev  # the above + the FULL prompt sent to claude (thinking calls AND the build harness)
CSLOP_DEBUG=verbose pnpm dev  # the above + the full model responses too
```

- `[dbg ai]` - every "thinking" model call through `dispatchAI` (task, route e.g. `claude-cli:sonnet`,
  duration, chars, cost; verbose adds the exact prompt/response).
- `[dbg spin]` - the spin passes (scout → proposals, spec, chat intent) per company.
- `[dbg chat]` - the company co-pilot chat pass.
- `[dbg run]` - build-run lifecycle (start/harness, green→approve/ship, fail).

Off = zero overhead. Build-run detail is also always in the UI's agent console + per-run logs.
