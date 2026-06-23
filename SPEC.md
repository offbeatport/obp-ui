# C Slop Slop — Spec v1

**One line:** an agent fleet that turns hunches into autonomously-run companies — research → build → launch → ads/SEO → iterate.

**Premise:** you don't write code, you direct agents. Intent is the source code.

**Surface:** *you have companies, you talk to them, things happen.* Agents / runs / orchestration are invisible engine — never things you manage.

---

## The loop
```
Hunch  →  Opportunities  →  Company  →  prioritized backlog of slices
(a sentence) (cheap, scored)  (the bet)        │
                          fleet pulls the top-priority slice, ships it, re-prioritizes ⟲
```

## Entities (5 tables — the whole schema)
- **opportunity** — cheap scored candidate from a hunch. `{ hunch, title, thesis, score, status: candidate|promoted|killed }`. Generate 50, keep 3.
- **company** — *the primitive.* The committed bet. `{ name, domain, repoUrl, thesis, status, metrics }`. **One company = one product** (no separate product entity).
- **feature** — *a vertical slice in the backlog.* `{ companyId, "user can do X", doneWhen, status: todo|shipped, priority, dependsOn? }`. A big bet ≈ 100 of these.
- **run** — *an execution* of a feature (or chore) by an agent. `{ featureId?, companyId, status, logs, artifacts }`. Durable, resumable, decomposable (a run can spawn sub-runs).
- **message** — chat. `{ companyId|null, role, content }`.

## Build law (non-negotiable)
1. **Every iteration ships one user-facing capability** — deployed, tested, **validated**. Done = live + proven, not "code written."
2. **No internal-only milestones.** Plumbing only ever rides *inside* a usable slice. Slice #1 = a **walking skeleton** (thinnest end-to-end thing a user can touch).
3. **Decomposition is by user outcome, never by technical layer.** Each sub-run is itself a shippable slice.
4. **The product is always live.** After slice 7 or slice 70 it's a working product — just smaller.
5. **Capability-agnostic.** No size/scope assumptions anywhere. A todo app and a niche data-warehouse are the same shape: a sequence of shipped slices — bigger just = more slices. As models improve, the ceiling rises with zero rewrites.

## The fleet (how N companies share one agent pool)
- **Continuous priority loop, not a pipeline:** `pick top-priority shippable slice (fleet-wide) → build → deploy → test → validate → re-prioritize → repeat.`
- A company is worked on **only when one of its slices is the top thing to do**, then dropped until it's top again — "agents resume when it's top priority."
- **Orchestrator** answers *"what should the fleet do next?"* via a real score (impact × confidence ÷ effort), respecting light dependencies, **steerable by chat** ("focus on X"), re-scored **on events** (slice shipped, user steer, new signal) — not continuously.

## Interface — chat is the spine (2 surfaces + inbox)
1. **Fleet** — board of companies with live progress + a global chat/command bar.
2. **Company** — chat (left) + live activity & artifacts (right): domain, landing preview, repo, metrics, the backlog, pending approvals.
3. **Opportunities** — inbox of candidates → promote to company.

No agent screen. No run-kind picker. You chat; the system decides what to run.

## Engine
- **Run executor** — one uniform background runner: spawns a CLI agent (`claude -p` / `codex`) or API, streams logs (SSE), checkpoints, resumes across restarts.
- **AI proxy** — per-task model/tool routing; swappable as models improve.
- **Stack** — TanStack Start + SQLite + Drizzle + Tailwind (single app at repo root).

## Git backbone
- Each company's code lives in **platform-owned git**, namespaced per user/company — not GitHub.
- **v1: bare git on the platform's own storage** (a repo per company in a volume). No git host, no rate limits, no ToS issues, multi-tenant by namespace.
- **Later: self-host Gitea** when users need to clone/browse/invite collaborators (lightweight, real git server + API + orgs/PRs). GitLab only if its heavy CI is ever needed.
- **GitHub is opt-in export/mirror per user**, never the backbone. (Auto-creating an org per company is a GitHub ToS/abuse non-starter.)
- **A "PR" = the in-app approval gate**, not a GitHub PR: render the diff in the company UI, approve → merge in our own git.

## Multi-user & deployment
- **Multi-tenant from the start**: users + auth; every company, repo, and run is isolated per user.
- **Git hosting ≠ deployment.** Where code lives (git backbone) and where a company *runs* (a live URL — containers/Coolify/Fly) are separate concerns.

## Autonomy ladder (grows; don't build it all at once)
- **L0 (v1):** chat-driven; you approve each slice.
- **L1:** per-company autopilot — standing loops within guardrails (budget caps, approval gates for risky/irreversible actions).
- **L2:** hunch → live company, unattended.

## v1 = one thin vertical slice
hunch → opportunities → promote to company → chat → **one feature** built → deployed → tested → **live URL**, with streaming logs + an approval gate + the priority loop running over a 1-company backlog. Then widen run kinds and add companies.

## Scope stance
- **Architecture forecloses nothing** — Snowflake-for-a-niche is a valid Company.
- **v1 validates on what ships today** (e.g. a token-saving LLM) — ship now, don't wait for better models.
- The only real gate is **non-code reality** (licenses, hardware, partnerships) — not model quality.
