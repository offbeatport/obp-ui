# TODO

Deferred work — things pulled out of the product for now, to revisit later.

## Spin flow (start a company)

- [ ] **"Surprise me" button** — auto-start a spin from a random/curated thought so the founder
      can watch the flow with zero input. Removed from the `/companies/new` composer for now
      (`src/routes/companies/new.tsx`); the `LUCKY_THOUGHTS` list + `lucky()` handler were the
      implementation. Re-add when the flow is polished enough to demo cold, and ideally have the
      engine pick the thought (scan trends) rather than a hardcoded list.

## Sidebar

- [ ] **Chats section** — the left rail's "Chats" list (recent portfolio conversations). Removed
      from `src/components/app-shell.tsx` for now (was a hardcoded `CHATS` placeholder). Ship in v2
      backed by real chat threads; the `chats` NavKey + `src/routes/chats/*` scaffolding remain.

## V3.

- [ ] **Chat channels as approval/distribution surface** — expose the ship/approval gate over chat
      (Telegram/Slack/WhatsApp), not just the web UI. Add a `ChannelSink` seam next to the existing
      `DigestSource` — one adapter per channel. When a run hits the ship gate, push
      "Company X built Y, live at <url>, validation passed — approve/reject?" to the channel and
      parse the reply back into the approve/reject the gate already expects. Payoff: steer companies
      from your phone. Mirrors OpenClaw's "autonomous loops from phones" without touching the engine.

- [ ] **Self-writing skills (capability-gap loop)** — when a company repeatedly needs a capability
      the pluggable harness (claude/codex/aider) lacks, have the executor author a reusable skill and
      persist it to a shared `skills` table so the next company inherits it. Concretely: `skills`
      table + a "capability gap" signal emitted during a run → a spin pass that authors the skill →
      validated the same way products are (deploy→verify) before joining the pool. Payoff: compounding
      capability across companies instead of every run starting cold.
