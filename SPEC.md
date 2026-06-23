# C Slop Slop — Spec v2

> **From thought to bag — and bag again.**

**One line:** turn a thought into a real, deployed software product — built, tested, and shipped by agents one validated slice at a time. *(Distribution — ads/SEO — and unattended autonomy are the destination, not v1.)*

**Premise:** you don't write code, you direct agents. Intent is the source code.

**Surface:** *you have companies, you talk to them, things happen.* Agents, runs, and orchestration are invisible engine — never things you manage.

---

## Who it's for / the daily loop
A solo founder running one (later many) bets. You open the app, drop a **thought**, skim generated **opportunities**, promote one to a **company**, and from then on you mostly **approve slices**: the agent proposes a shipped change (diff + a live preview URL + a passing check), you approve or reject-with-feedback, repeat. The thing you wait for between approvals is a *working, deployed slice* — not a plan.

## The loop
```
thought  →  opportunities  →  company  →  bag → bag → bag
(a sentence)  (cheap, scored)   (the bet)   (validated, deployed slices)
        agents pull the top-priority slice, ship it (live + proven), re-prioritize ⟲
```

## Entities (5 tables — the whole schema)
- **opportunity** — a cheap scored candidate from a thought. `{ thought, title, thesis, score, status: candidate|promoted|killed }`. *(Fan-out counts are illustrative, tuned per cost.)*
- **company** — *the primitive.* The committed bet. `{ name, gitRemote, thesis, status: active|paused|archived, domain?, metrics? }`. One company = one product.
- **feature** — *a vertical slice (the backlog unit).* `{ companyId, title("user can do X"), doneWhen, status: todo|building|awaiting_approval|shipped|blocked, priority, dependsOn? }`. **`doneWhen` is an executable check** (an HTTP probe / smoke assertion against the running URL), not prose.
- **run** — *one flat execution of a feature by an agent* (no sub-runs in v1). `{ featureId, companyId, status: queued|running|awaiting_approval|succeeded|failed|cancelled, attempt, checkpoint, error?, startedAt, finishedAt, agentKind, leaseExpiresAt }`.
  - **checkpoint** = the last durable point: `{ gitSha, lastStep }`. **Resume after restart** = re-spawn the agent from the last checkpoint; if a killed `claude -p` can't resume cleanly, mark the run `failed` and re-queue if `attempt < max`. (A subprocess can't literally resume — resumption is replay-from-checkpoint.)
- **message** — chat. `{ companyId|null, role, content }`.

## Build law (non-negotiable — keep verbatim)
1. **Every iteration ships one user-facing capability** — deployed, tested, **validated**. Done = live + proven, not "code written."
2. **No internal-only milestones.** Plumbing only ever rides *inside* a usable slice. Slice #1 = a **walking skeleton** (thinnest end-to-end thing a user can touch).
3. **Decomposition is by user outcome, never by technical layer.** Each slice is independently shippable.
4. **The product is always live.** After slice 7 or slice 70 it's a working product — just smaller.
5. **Capability-agnostic.** No size/scope assumptions; bigger = more slices; the ceiling rises with models, with zero rewrites.

## Validation contract (what makes "proven" real)
- A slice's `doneWhen` is **executed by a step distinct from the builder.** The agent that wrote the code does **not** get to declare it valid.
- `feature.status → shipped` fires **only** on a green check against the live URL. A red check → retry up to N, then `blocked` (surfaced to chat). Never auto-pass.
- A slice is only *shippable* when its `dependsOn` are already `shipped` and green.

## Slice generation (how the backlog gets populated)
- On **promote** (opportunity → company), a **planning run** decomposes the company into the first vertical slices (`title` + executable `doneWhen` + initial `priority`/`dependsOn`), starting with the **walking skeleton**.
- The backlog grows over time (chat asks, new slices) — but it's never empty after promotion, so the priority loop always has something to pull.

## How agents share the work
- **Continuous priority loop, not a pipeline:** pick the top-priority shippable slice (across all companies) → build → deploy → test → validate → re-prioritize → repeat.
- A company is **locked while a run is active** (`company.lockedByRunId`, acquired in the same transaction that leases the run; auto-released on lease expiry) so two agents can't double-ship or corrupt its `slop`.
- **The orchestrator** picks by a score (impact × confidence ÷ effort → a single `feature.priority`), respects `dependsOn`, is **steerable by chat** ("focus on X"), re-scored on events.
- **Kill-switch (v1, not later):** every run has a wall-clock cap + max-attempts + no-progress detection (same diff/failure repeated → stop, don't resume). A stuck slice goes `blocked` so it can't livelock the loop or burn the subscription unattended. *(This replaces cost-metering for v1.)*

## Approval gate (L0 — v1's headline)
- The human approves a **slice**: shown the **diff + the live preview URL + the validation result**.
- While waiting, the run sits in `awaiting_approval` (it isn't "running", isn't done).
- **Reject-with-feedback** sends the slice back as a new attempt with the note attached.

## Interface — chat is the spine (2 surfaces + inbox)
1. **Companies** — board of your companies with live progress + a global chat/command bar.
2. **Company** — chat (left) + live activity & artifacts (right): preview URL, diff/approval, the backlog, per-slice status, recent runs.
3. **Opportunities** — inbox of candidates → promote to company.

No agent screen. No run-kind picker. You chat; the system decides what to run. *(Borrowed lesson: keep autonomy legible — surface per-slice status + a preview URL so it's trustable, not opaque.)*

## Engine
- **Run executor** — one uniform background runner: spawns a CLI agent (`claude -p` / `codex`) or API, streams logs (SSE), writes a `checkpoint` (gitSha + step) as it goes, resumes by replay, enforces the kill-switch.
- **Deploy (v1 = real but minimal):** each company runs in a **real local container with a real `localhost` URL**. Not stubbed — `doneWhen` hits that URL. (Real remote hosting — Coolify/Fly — is a later swap behind the deploy seam.)
- **AI proxy** — per-task model/tool routing; swappable as models improve.
- **Stack** — TanStack Start + SQLite + Drizzle + Tailwind, single app at repo root. **Boot-time `CREATE TABLE`** for v1 (greenfield; no migrations yet).

## Git backbone (v1: simplest thing that works)
- **v1 = bare local git**, one repo per company, with a **`slop/` folder** inside it. `company.gitRemote` + a **git-provider interface** is the seam.
- **Sovereignty:** each repo has a short, provider-agnostic **`AGENTS.md`** (`CLAUDE.md`/`CODEX.md` point to it): read `slop` first, ship one validated slice, persist back. So **`git clone + claude` continues a company with no platform** — the platform is just that loop, automated and prioritized.
- *Deferred (post-v1, behind the same seam):* self-hosted Gitea, org/multi-repo (`app`/`site`/`slop`) layouts, per-repo visibility, GitHub export. None of it is built now.

## `slop` — the company brain
Prose only. Agents read it to resume; humans read it to understand the company.
```
slop/
├── spec.md        # the bet: what it is, who it's for, the wedge (stable, ≤1 page)
├── roadmap.md     # narrative of where the build is — DERIVED from the DB, prose only (NO live priority/status numbers)
├── decisions.md   # append-only, terse one-liners (what + why)
└── research/      # distilled opportunity/market notes
```
- **`slop` is the readable narrative; the DB is the operational truth.** Status, priority, queue, run state, metrics, raw logs live in the DB — **never** in `slop`.
- `roadmap.md` is a **generated projection** of the DB (regenerated on re-prioritization), so it never becomes a competing source of truth.
- Keep files lean — git history holds the trail. *(Compaction/anti-rot is deferred; nothing to compact at one company.)*

## Competitive positioning
The "agents run a company" space is real and funded — closest is **Polsia** (≈the same pitch, $30M raised, but ~1.8/5 trust: builds anything with no demand check, "marked done but never deployed", lock-in) and **Hyperagent** (Airtable-backed *generalist* white-collar automation). C Slop Slop wins on the two things both structurally lack:
1. **Validated** — a scored-opportunity gate (don't build what nobody wants) + the Build Law enforced in code (a slice isn't done until it's **live and proven**). This directly answers Polsia's worst complaint.
2. **Portable** — every company is a git repo you own; `git clone + claude` continues it with no platform. Anti-lock-in as a feature.
3. **Honest & reliable** — explicit approval ladder (L0 now); slower, but it actually ships. Narrow software-factory focus over generalist sprawl.

## Deferred (named, not built)
Multi-tenant auth + per-user isolation + agent **sandboxing** (mandatory *before* multi-user — gate it then, don't build now) · Gitea + multi-repo + GitHub export · sub-runs / recursive decomposition · cost/token metering + budget caps · scheduler fairness/anti-starvation · `slop` compaction · remote deploy · Postgres/scale. Each stays a one-line forward-reference behind an interface seam.

## Autonomy ladder
- **L0 (v1):** chat-driven; you approve each slice.
- **L1:** per-company autopilot within guardrails (budget caps, approval gates for risky/irreversible actions).
- **L2:** thought → live company, unattended.

## v1 = prove the one bet first
Before any opportunity/board/inbox UI: build **one hardcoded feature** end-to-end — *a visitor can sign up on a live (local) URL* — through the full path (agent builds → deploys to a local container → `doneWhen` check hits the URL → approval gate). **Measure cold-run success over ~10 runs; require ≈≥7/10** before building the funnel around it. Then: thought → opportunities → promote → planning run → priority loop over a one-company backlog. Single-user, local. Auth/Gitea/remote-deploy slot in later behind their seams.

## Scope stance
- **Architecture forecloses nothing** — a Snowflake-for-a-niche is a valid company (just more slices).
- **v1 validates on what ships today** (e.g. a token-saving LLM) — ship now, don't wait for better models.
- This is a **clean rewrite** — `company` is not the old `project`, `run` is not the old `build_run`; fresh schema.
- The only real gate is **non-code reality** (licenses, hardware, partnerships) — not model quality.
