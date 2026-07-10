# C Slop Slop — Spec v4

> **From thought to bag — and bag again.**

**One line:** turn a thought into a real, deployed software product — built, tested, shipped, **distributed, and monetized** by agents one validated move at a time, on **bounded autopilot**. *(Real money / real ad-spend and **fully-unattended** autonomy (L2) are the destination, not v1.)*

**Premise:** you don't write code, you direct agents. Intent is the source code.

**Surface:** *you have companies, you talk to them, things happen.* Agents, runs, and orchestration are invisible engine — never things you manage.

> **v4 changes (simplified, same scope):** everything you act on is now **one unit — an `action`** (ship code · send a message · spend money), shown as *preview + evidence + Approve/Reject*. Features, channels, outreach drafts, and spend approvals collapse into that one queue. The whole app is **one screen** (a prioritized action queue + chat), governed by **one autopilot rule**. **Full e2e v1 scope is unchanged** — build + distribute + monetize + autopilot all ship; they're just *action-types in the same queue*, not separate machinery. (v3's 6 tables → 5; 3 user-facing nouns.)

---

## How to think about it (first principles)
Under the surface poem ("from thought to bag"), the engine is one thing:

> **An evidence engine.** It spends compute + budget to buy evidence about which bets deserve more — **cheapest-validation-first** — and **nothing counts until it's live + proven.** Reality is the only currency.

Every rule below is either a **rung on the evidence ladder** or a **gate that stops you climbing before the evidence justifies it**:

| rung | cost / commitment | question it answers |
|---|---|---|
| thought | free | is there even a wedge? |
| opportunity **score** | cents (LLM fan-out) | does anyone want it? — *kill losers for pennies* |
| walking skeleton **live** | agent-hours | can it build + deploy at all? |
| **`doneWhen`** green | one run | does this capability actually work? |
| **adoption** | real/test traffic | does anyone use it? — *iterate / drop* |
| **test-mode** payment | still $0 (test keys) | does the money mechanism work? |
| real MRR · CAC↔LTV *(seams, later)* | real money | will they pay? does acquisition scale? |

You climb a rung only when the one below it paid off. This single law *derives* the rest — the opportunity gate, the Build Law, the validation contract, the kill-switch, the budget cap, test-mode-first, bounded autopilot. They aren't separate rules; they're all "buy cheap evidence before expensive commitment."

**The whole machine in one decision rule:** *take the action that buys the most decision-relevant evidence per unit of compute* — which is exactly what `impact × confidence ÷ effort` approximates and what keep/kill/pivot executes.

## The one unit — an `action`
Everything the engine proposes and everything you approve is the **same shape**: a *proposed real-world move* = **preview + evidence + Approve / Reject-with-feedback**. An action is one of three **types**:

- **`code`** — ship a feature ("user can do X"). Carries an executable `doneWhen`; ships only on a green check. *(A code action is a **feature** — the word stays for build work.)*
- **`message`** — talk to the world: a build-in-public post, a cold-outreach batch, a support reply. "Done" = you approve & it sends.
- **`money`** — spend / go-live: authorize an ad test, flip payments live. "Done" = you authorize.

This is the simplifier: **features, channels, outreach drafts, and spend approvals are all actions.** Adding a new motion later (a new channel, a new outreach type) is a new action — *not new architecture*. The autopilot rule, the queue, the approval gate, and the evidence ladder all operate on this one unit.

## Entities (5 tables — the whole schema; 3 you ever see)
- **opportunity** — a cheap scored candidate from a thought. `{ thought, title, thesis, score, status: candidate|promoted|killed }`.
- **company** — *the primitive.* The committed bet. `{ name, gitRemote, thesis, status: active|paused|archived, domain?, pricing?, channels[] (kind: seo|ads|content|outbound|referral · status · budgetIntentUsd?), metrics? (mrr, users, adoption), autopilot: off|on, budgetCapUsd? }`. One company = one product.
- **action** — *the queue/backlog unit (absorbs v3's `feature` + channel-drafts + spend).* `{ companyId, type: code|message|money, title, evidence?, reversible: bool, status: queued|running|awaiting_approval|done|blocked, priority, dependsOn?, payload }`. `payload` by type: **code** `{ doneWhen, diff, previewUrl }` · **message** `{ channel, draft, recipients? }` · **money** `{ amountUsd, target }`. `done` = shipped (code) / sent (message) / authorized (money). `type` + `reversible` drive the **one autopilot rule** (below).
- **run** — *invisible engine detail: one flat execution of a `code` action by an agent.* `{ actionId, companyId, status: queued|running|awaiting_approval|succeeded|failed|cancelled, attempt, checkpoint{gitSha,lastStep}, costUsd, agentKind, leaseExpiresAt, error? }`. **Resume after restart = replay-from-checkpoint**; if a killed `claude -p` can't resume cleanly, mark `failed` and re-queue if `attempt < max`. `costUsd` sums per company for the budget cap.
- **message** — chat. `{ companyId|null, role, content }`.

## The loop
```
thought  →  opportunities  →  company  →  action → action → action
(a sentence)  (cheap, scored)   (the bet)    (validated moves: code · message · money)
        agents pull the top-priority action, do it (proven), re-prioritize ⟲
        you only ever do two things:  PROMOTE a bet  ·  APPROVE an action
```

## Build law (non-negotiable — keep verbatim) — governs `code` actions
1. **Every iteration ships one user-facing capability** — deployed, tested, **validated**. Done = live + proven, not "code written."
2. **No internal-only milestones.** Plumbing only ever rides *inside* a usable feature. Feature #1 = a **walking skeleton** (thinnest end-to-end thing a user can touch).
3. **Decomposition is by user outcome, never by technical layer.** Each feature is independently shippable.
4. **The product is always live.** After feature 7 or feature 70 it's a working product — just smaller.
5. **Capability-agnostic.** No size/scope assumptions; bigger = more features; the ceiling rises with models, with zero rewrites.

> **Acquisition and monetization are actions too** — "a visitor lands on an SEO page" (code), "post the launch" (message), "user can pay" (code, test-mode), "authorize the ad test" (money) are all moves in the one queue. No special-casing.

## Validation contract (what makes "proven" real)
- A `code` action's `doneWhen` is **executed by a step distinct from the builder.** The agent that wrote the code does **not** get to declare it valid.
- A code action → `done` fires **only** on a green check against the live URL. A red check → retry up to N, then `blocked` (surfaced to chat). Never auto-pass.
- Shippable only when `dependsOn` are already `done` and green.
- **`doneWhen` examples:** *capability* — `GET /digest/preview → 200, body contains "Top leads"`. *acquisition* — landing page 200 + required `<meta>` + reachable `sitemap.xml`. *monetization* — a **Stripe test-mode** checkout completes, `payment_intent` reaches `succeeded` (test keys, no real charge).
- `message`/`money` actions aren't build-validated but **always pass through the approval gate** (they touch real humans / real money) and carry their own evidence (last post's reach, batch reply-rate, channel conversion).

## Action generation (how the queue gets populated)
- On **promote** (opportunity → company), a **planning run** decomposes the bet into the first `code` actions (`title` + `doneWhen` + `reversible` + `priority`/`dependsOn`), starting with the **walking skeleton**.
- That same run **seeds the company brain from the opportunity** — no manual chore: `slop/spec.md` from the opportunity's `thesis`, and the opportunity's research into `slop/research/` as the **opportunity report**. Every company is *born* with a thesis + a demand report.
- The queue grows over time (chat asks; the engine proposes acquisition/monetization actions as the bet matures; support tickets seed `code` actions). Never empty after promotion, so the priority loop always has something to pull.

## Full e2e scope (all v1 — all via actions)
- **Build** = `code` actions (the product). The walking skeleton, then capability + depth features.
- **Distribute** = `code` acquisition features (SEO page, referral, share) + `message` actions (build-in-public posts, cold outreach) + the company's `channels[]` (record-intent; real ad-platform spend is a `money` action behind the ads seam).
- **Monetize** = a `code` "user can pay" feature on **Stripe test-mode** + `pricing` config + **MRR** in `metrics`; going live = a `money` action behind the payments seam. Domain stays record-intent.
- **Autopilot** = the one rule below.
- *(v1 keeps external money/spend at **test-mode + record-intent** — the e2e capability is real; the irreversible real-world spend is the only thing behind a seam.)*

## How agents share the work
- **Continuous priority loop, not a pipeline:** pick the top-priority ready `code` action across all companies → build → deploy → test → validate → re-prioritize → repeat. (`message`/`money` actions sit in the same queue, surfaced to you.)
- A company is **locked while a run is active** (`company.lockedByRunId`, acquired in the run-lease transaction; auto-released on lease expiry) so two agents can't double-ship or corrupt its `slop`.
- **The orchestrator** ranks by `impact × confidence ÷ effort → action.priority`, respects `dependsOn`, is **chat-steerable** ("focus on X"), re-scored on events (incl. adoption + support signals).
- **Kill-switch + budget cap:** every run has a wall-clock cap + max-attempts + no-progress detection (same diff/failure repeated → stop). A stuck action goes `blocked`. A coarse per-company **`budgetCapUsd`** (sum of `run.costUsd`): hitting it **pauses autopilot back to L0** and surfaces to chat — unattended runs can't quietly burn the subscription.

## Altitudes (the engine's reasoning + your zoom levels)
`action ⊂ company ⊂ portfolio` — same loop at three scales:
- **action** — the build unit, the ad wedge, the measured thing you iterate (improve / build adjacent / drop). Action-level metrics update `confidence`/`impact` → re-prioritize the queue (that *is* "iterate").
- **company** — the bet: actions + channels + pricing → MRR/users/retention → **keep / improve / pause / kill / pivot**. (A feature can win while the company loses — that verdict lives only here.)
- **portfolio** — the scarce pool (your attention + the agent fleet + total budget) allocated across bets. The real leverage.
- **Wedge vs depth:** acquisition targets the **wedge** (1–2 hero features that are the reason someone shows up); depth features are usage-measured, never independently advertised. You acquire **company-users**, not feature-users.

## Approval gate (L0 — the headline) — one gate for every action
- You approve an **action**: shown its **preview + evidence + result** — for `code`, the *diff + live preview URL + green `doneWhen`*; for `message`, the *draft + the channel + prior reach*; for `money`, the *amount + the evidence that justifies it*.
- While waiting, it sits in `awaiting_approval`. **Reject-with-feedback** sends it back as a new attempt with the note attached.

## Autopilot (L1 — bounded autonomy, v1) — one rule
> **Reversible `code` actions can auto-run on a green check. Every `message` and `money` action always waits for you.**

- Per-company **`autopilot: off|on`**, **default off** until you trust the company; chat-steerable; flip back to L0 anytime.
- **Guarded by:** the budget cap (pauses autopilot when hit) + the kill-switch. **Single-user, local only** — agent **sandboxing stays gated to multi-user** (autopilot never runs against a shared host).
- **Why bounded:** autonomous spend and autonomous human-facing messages are where the trust moat dies. Keeping `message`/`money` behind the gate is what keeps "reliable" honest.

## Interface — one screen, chat is the spine
**One surface: the Action Queue.** A single prioritized list — **Needs you** (actions awaiting your approval) + **Up next** (what the engine will pull) — **filterable by company**, with a **global chat/command bar** as the spine. That's the whole app.
- **Promote** lives in an opportunities filter of the same surface (candidates → promote).
- **Zoom for context:** click a company or an action to expand its context inline — backlog, metrics, comms history, the **thesis + opportunity score + opportunity report** (`slop/research/`). The old jobs (Build · Distribute · Monetize · Measure · Steer) are **lenses/filters on the one queue**, not separate screens.
- No agent screen. No run-kind picker. You chat; the system decides what to run. *(Keep autonomy legible — surface per-action status + preview + what autopilot did.)*

## Engine
- **Run executor** — one uniform background runner: spawns a CLI agent (`claude -p` / `codex`) or API for `code` actions, streams logs (SSE), writes `checkpoint` (gitSha + step), records `costUsd`, resumes by replay, enforces kill-switch + budget cap, applies the one autopilot rule.
- **Deploy (v1 = real but minimal):** each company runs in a **real local container with a real `localhost` URL** — `doneWhen` hits it. (Remote hosting — Coolify/Fly — is a later swap behind the deploy seam.)
- **Payments / ads / domain seams** — Stripe **test-mode**, recorded ad channels, record-intent domains; each an interface so the real provider swaps in later with no rewrite.
- **AI proxy** — per-task model/tool routing; swappable as models improve.
- **Design system (engine, invisible) — v1 = one style + one archetype.** Each company gets an in-repo, agent-readable design spec (tokens + component conventions, e.g. `slop/design/` or a dev-only `/design` route) that the builder reads throughout the app's evolution so the UI stays coherent — the antidote to LLM slop, and it *raises* `doneWhen` pass-rate by shrinking the decision space. v1 ships exactly what BurningDemand needs (one shadcn-based style, one archetype); the library is **extracted from real shipped apps, not invented up front.** User-switchable styles are cheap (swap a shadcn CSS-variable token file). Kept in the engine — not a screen.
- **Stack** — TanStack Start + SQLite + Drizzle + Tailwind, single app at repo root. **Boot-time `CREATE TABLE`** (greenfield; no migrations yet).

## Git backbone (v1: simplest thing that works)
- **v1 = bare local git**, one repo per company, with a **`slop/` folder** inside it. `company.gitRemote` + a **git-provider interface** is the seam.
- **Sovereignty:** each repo has a short, provider-agnostic **`AGENTS.md`** (`CLAUDE.md`/`CODEX.md` point to it): read `slop` first, ship one validated feature, persist back. So **`git clone + claude` continues a company with no platform** — the platform is just that loop, automated and prioritized.
- *Deferred behind the same seam:* Gitea, multi-repo (`app`/`site`/`slop`), per-repo visibility, GitHub export.

## `slop` — the company brain
Prose only. Agents read it to resume; humans read it to understand the company.
```
slop/
├── spec.md        # the bet: what it is, who it's for, the wedge (stable, ≤1 page)
├── decisions.md   # append-only, terse one-liners (what + why — incl. autopilot flips, pricing/pivot)
└── research/      # distilled opportunity/market notes (the opportunity report)
```
- **`slop` is the readable narrative; the DB is operational truth.** Status, priority, queue, run state, metrics, costs, channels, autopilot all live in the DB — **never** in `slop`.
- **Snapshot vs living:** the **opportunity report** (`research/`) is point-in-time demand evidence *as it was at promotion* — don't rewrite it. `spec.md` is the **current** bet (may evolve); `decisions.md` is the why-it-changed trail; `metrics` (DB) is the live "is the thesis still true?" read.
- *(v3's `roadmap.md` dropped — it was a generated projection of the DB; nothing to project at one company. Re-add behind a seam if a company ever needs it.)*

## Competitive positioning
The "agents run a company" space is real and funded — closest is **Polsia** (≈the same pitch, $30M raised, ~1.8/5 trust: builds with no demand check, "marked done but never deployed", lock-in) and **Hyperagent** (Airtable-backed *generalist*). C Slop Slop wins on three things both lack:
1. **Validated** — a scored-opportunity gate + the Build Law in code (no `done` without live + proven; no monetization `done` without a green test payment). Answers Polsia's worst complaint.
2. **Portable** — every company is a git repo you own; `git clone + claude` continues it. Anti-lock-in as a feature.
3. **Honest & reliable** — one approval gate + **bounded** autopilot (message/money always gated); slower, but it actually ships.

## Deferred (named, not built)
**L2 fully-unattended** autonomy · **real money** — live Stripe, real domain purchase, real ad-spend (v1 = test-mode + record-intent) · multi-tenant auth + isolation + agent **sandboxing** (mandatory *before* multi-user; autopilot is single-user/local until then) · Gitea + multi-repo + GitHub export · sub-runs / recursive decomposition · **granular** token metering (v1 has only a coarse USD cap) · scheduler fairness · `slop` compaction · `roadmap.md` projection · remote deploy · Postgres/scale · **design-system library** (a growing set of shadcn styles × app archetypes — directory / dashboard / generic — that CSlopSlop auto-picks and the user can switch; grown from real shipped apps, v1 has only one of each). Each stays a one-line forward-reference behind a seam.

## Autonomy ladder
- **L0 (v1):** chat-driven; you approve each action.
- **L1 (v1):** per-company **bounded autopilot** — reversible `code` actions auto-run on green within the budget cap; every `message`/`money` action stays gated to L0.
- **L2 (destination):** thought → live company, fully unattended (needs full metering + sandboxing + risk-gating first).

## v1 = full e2e on one company (prove the spine first, then widen — all of it is v1)
v1's **target is the full loop**: build + distribute + monetize + autopilot, end-to-end, on a real (local) deploy. The only discipline is **build order, not scope**:
1. Prove the spine: one hardcoded `code` action end-to-end — *a visitor can sign up on a live local URL* (agent builds → local container → `doneWhen` hits the URL → approval gate). **Cold-run ≈≥7/10 over ~10 runs** before widening.
2. Then the real loop on one company: thought → opportunities → promote → planning run → priority queue of `code` actions → a **monetize** action ("user can pay", test-mode) → **distribute** actions (SEO features + build-in-public/cold `message` actions + channels) → flip **autopilot** on.
Single-user, local. Auth / Gitea / remote-deploy / real-money slot in later behind their seams.

## Scope stance
- **Architecture forecloses nothing** — a Snowflake-for-a-niche is a valid company (just more actions).
- **v1 validates on what ships today** — ship now, don't wait for better models.
- **Clean rewrite** — `company` is not the old `project`, `run` is not the old `build_run`; fresh schema.
- The only real gate is **non-code reality** (licenses, hardware, partnerships, **payment-processor / ad-account approval**) — not model quality.
