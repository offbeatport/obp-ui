# BurningDemand — Product Requirements Document

**Version:** 1.1 · 2026-07-17 · Owner: Vlad Palos
**For:** a builder agent implementing the product end-to-end. This document is self-contained; where it references cslopslop it names exact files to lift code from.

---

## 1. One-liner

**Paste a rough product idea → get back a paid market-research report: 5 genuinely distinct, brandably-named opportunities scored on 8 demand signals, with REAL cited evidence, competitor gaps, a concrete acquisition channel, kill criteria, and the cheapest real-world experiment to validate each.**

Domain: `burningdemand.com` (owned). Deliverable name: the **Demand Report**.

## 2. Why this exists (the value-add — do not dilute it)

- **The trust asymmetry.** The founder has no audience and no track record. "Trust my AI to build your company" requires maximum trust; "pay $29 for a report you can verify in five minutes" requires minimum trust. This product deliberately sits at the bottom of the trust ladder. Everything about it must be **verifiable by the buyer**: every evidence item cites a real URL they can click; every number names its basis.
- **The differentiation.** "AI idea generators" are a red-ocean commodity (one prompt, plausible prose, zero evidence). BurningDemand sells **evidence-scored validation**, not ideas: licensed web-grounded citations, real search-volume numbers, named competitors with the gap you'd exploit, a named channel where the buyer already congregates, and a falsifiable kill criterion. It's a validation *playbook*, not a horoscope.
- **The engine already exists.** cslopslop's `market` module (two-stage ideation→expansion, judge-panel-validated prompts, 8-signal rubric with per-score justifications, anti-echo naming) produces the core content. This product wraps it in evidence grounding + payments + delivery.

**The honest moat (internal — guides decisions, never appears in copy):** the pipeline itself is thin-moat; a competent builder could clone it in a weekend, and deep-research chat tools produce adjacent output. What the buyer actually pays for: the *reframe* (5 better versions of their question), the fixed rubric + an opinionated verdict, quantitative keyword data chat tools don't return, verified-or-refunded citations, and a finished artifact requiring zero prompting skill. What defends the business over time is NOT the tech — it's distribution (the Daily Burn feed + build-in-public), brand trust, and the proprietary dataset of ideas → evidence → outcomes. Consequences: ship fast, don't over-engineer the pipeline, never publish the prompts.

## 3. Target user & JTBD

Indie hackers, solo founders, side-project builders, agency devs picking a niche. **Job:** "Before I burn 3 months building, tell me if anyone actually pays for this — and show me the receipts." Secondary: content marketers/VCs scanning niches.

Willingness-to-pay is episodic → **one-shot pricing, never subscription** (validation demand is bursty; subscriptions churn instantly in this market).

## 4. Business model & pricing

| SKU | Price | Notes |
|---|---|---|
| 1 Demand Report | **$29** | Stripe Checkout, one-shot |
| 3-report pack | **$59** | Delivered as 2 extra single-use credit codes in the receipt email |
| Launch discount | `$19` via promo code | For the build-in-public launch only |

- **No accounts in v0.** Email-based delivery; credits are unguessable single-use codes.
- **Money-back promise (verbatim, on the landing page + report):** *"If the evidence in your report doesn't check out, reply to the delivery email and we refund you in full."* This is both a conversion asset and an internal quality forcing-function.
- Target COGS ≤ **$2.00/report** (LLM + search + keyword API). Alert if a single report exceeds $4.

## 5. v0 scope — the complete user journey

1. **Landing page** (`/`): promise, the 8-signal rubric explained, a full **sample report** (a real generated report, hand-verified), the money-back badge, "delivered in ~10 minutes", FAQ, Terms/Privacy links. Single CTA → order form.
2. **Order form** (`/start`): textarea for the idea (10–500 chars), optional "constraints" field (target market, things to avoid), email field. → Stripe Checkout (hosted page). Promo codes enabled.
3. **Payment webhook** (`checkout.session.completed`): create a `report` job row (status `queued`), fire a "we're on it — ~10 minutes" email.
4. **Worker** picks up the job, runs the generation pipeline (§7), writes the report, marks `done`.
5. **Delivery email** (Resend): link to the hosted report page.
6. **Report page** (`/r/<40-char-token>`): the full report as a clean, printable HTML page (print CSS = the "PDF"). `noindex`. No auth beyond the unguessable token.
7. **Failure path:** if generation fails after 3 retries → status `failed`, automatic apology email + automatic Stripe refund + alert to the operator (email). Never leave a paid customer hanging silently.
8. **Credit redemption** (`/redeem`): enter code + idea + email → same pipeline, no payment.

**That is all of v0.** See Non-goals (§12) before adding anything.

## 6. The Demand Report — exact content spec

Header: the user's idea (verbatim), date, report ID, a one-paragraph **executive verdict** (which of the 5 to pursue and why — or "none clear a 7.0; here's what's missing"), and a ranked scoreboard of the 5.

Each of the **5 opportunities** (all fields required):

| Field | Requirement |
|---|---|
| **Name** | Brandable startup-grade name. HARD anti-echo rule: never the user's words, never their phrase + suffix (Pro/Hub/AI/Flow/…). Lift the naming rules verbatim from cslopslop `IDEATE_SYSTEM`. |
| **Description** | 2–3 sentences: the bet. |
| **Pain** | The concrete recurring problem, phrased like an overheard buyer quote. |
| **ICP buyer** | Role + context + budget reality. Specific enough to email tomorrow. |
| **Wedge / why-buy / why-now** | The winning angle; the money/time reason they pay; the 2024–2026 timing shift. |
| **8 scores + justification each** | buyer, pain, wtp, timing, build, legal, distro, pricing — integer 0–10 + one-line *why* per score. Weighted overall score (WTP ×2, ÷9 — the cslopslop formula). Honest spread; not everything is an 8. |
| **Competitor table** | 2–3 rows: tool (incl. the DIY/spreadsheet option) · why people pay for it today · the gap/critical weakness to exploit. |
| **Distribution** | ONE named, concrete channel (a specific subreddit/community/association/marketplace), not "social media". |
| **Expected MRR** | low–high USD + basis (e.g. "~120 customers × $39/mo"). |
| **Risk** | The single biggest thing that could kill it. |
| **Kill criteria** | Falsifiable: "If X doesn't happen within Y weeks / N attempts, stop." |
| **Cheapest validation experiment** | Concrete: what to build/post (≤ $100, ≤ 7 days), where, and the numeric success threshold. |
| **Evidence (3–5 items)** | Each: kind (`demand`/`gap`/`price`/`volume`) + claim + **real resolvable URL** + retrieval date. At least one item MUST carry quantitative search-volume data. **No URL → the item does not ship.** |

Tone rules: analyst, concrete, zero hype. Bans: "game-changer", "massive potential", unexplained superlatives. UK/US spelling consistent. The report must read like paid research, not AI output.

## 7. Generation pipeline (the engine)

Port cslopslop's two-stage design (proven: single big calls time out; small staged calls don't):

1. **Ideate** — 1 call → 5 seeds `{title, wedge, icp, pain, whyNow}`. Lift `IDEATE_SYSTEM` (worked examples, naming rules, self-rubric) from `cslopslop/src/engine/spin.ts`.
2. **Ground** — per seed, 2–4 **licensed** search calls (§8): demand chatter, competitors + pricing pages, keyword volume. Output: candidate evidence items with URLs + snippets.
3. **Expand** — 5 parallel calls, one per seed. Input: seed + grounded evidence. The model may only cite evidence from stage 2 — instruct it that **inventing a source is a critical failure**. Adds scores/justifications, competitor table, MRR, risk, kill criteria, experiment. Lift `EXPAND_SYSTEM` as the base.
4. **Validate (independent gate — a different model/prompt than the writer; the builder never self-certifies):**
   - HTTP-check every evidence URL (HEAD/GET, follow redirects; drop items that 404; regenerate the opportunity if it falls under 3 evidence items).
   - Anti-echo name check (no token overlap with the user's idea words; no banned suffix). Regenerate name on failure.
   - Field completeness + score-justification sanity (a validator LLM pass: "would a skeptical buyer call this fabricated or vague?").
   - Only a fully passing report ships. Persist the validation results on the report row.
5. **Render** — JSON → HTML report page + plaintext email. Store the raw JSON (future dataset value).

Models via OpenRouter (operator's key): ideation/expansion = a Sonnet-class model; validation = a different, cheaper model. Every stage has a timeout (90s) + 3 retries. Idempotent per report ID. p95 end-to-end target: **≤ 10 min**.

**Prompt-injection note:** the user's idea text is untrusted input embedded in prompts. Wrap it in delimiters, instruct models to treat it as data, and strip/refuse instructions found inside it. Also refuse obviously abusive/illegal idea prompts (a cheap moderation check before spending).

## 8. Evidence sourcing — licensed only (hard requirement)

**Banned:** direct scraping of Reddit or use of Reddit's Data API for this commercial product; any per-platform scraping with restrictive ToS. (The predecessor pipeline did this; it is explicitly retired. This is a legal + platform-risk decision, not a style choice.)

**Approved stack:**

| Purpose | Provider (pick per availability) |
|---|---|
| Web-grounded evidence w/ citations | **Perplexity Sonar** (primary; routing pattern exists in cslopslop) or **Exa** / **Tavily** / **Brave Search API** |
| Search/keyword volume (quant demand) | **DataForSEO** (primary) or Keywords Everywhere |
| Community chatter (allowed) | **Hacker News via Algolia HN Search API** (openly provided) |
| Optional corpora | Stack Exchange dumps (CC-BY-SA), App Store review RSS, Product Hunt API |

Rule of thumb: consume licensed indexes and **cite the public URL**; never bulk-harvest a platform and never present a source you didn't retrieve.

## 9. Tech architecture

Mirror the proven cslopslop pattern (the builder agent may reuse code freely — same owner):

- **Stack:** TanStack Start (React 19) + SQLite (WAL) + Drizzle. Tailwind v4. Biome. Vitest.
- **Two processes:** web (landing, checkout, report pages, webhook) + a `tsx` **worker** polling a `report_jobs` table (status: `queued → running → done|failed`, lease + retry columns). No message broker. Crash-safe: reclaims on boot.
- **Tables:** `orders` (stripe session, email, sku, promo), `credits` (code, order, redeemed_at), `reports` (id, token, idea, constraints, email, status, json, html, cost_usd, validation, timestamps), `events` (audit log).
- **Integrations:** Stripe Checkout + webhook (verify signature); Resend (verified domain, from `reports@burningdemand.com`); OpenRouter; Sonar/Exa; DataForSEO.
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY` (or Exa), `DATAFORSEO_LOGIN/PASSWORD`, `APP_URL`.
- **Ops:** single VPS or Fly.io; SQLite file + nightly backup; `/healthz`; error alerts to operator email. Rate-limit order creation per IP/email (abuse).
- **Analytics (privacy-light):** page views, checkout starts, purchases, refunds — Plausible or a tiny events table. No trackers on report pages.

**Reuse pointers (cslopslop repo):** `src/engine/spin.ts` (IDEATE_SYSTEM, EXPAND_SYSTEM, two-stage flow, coercion), `src/config/spin.ts` (score rubric/meta/formula, markdown serializers), `src/engine/dispatch.ts` (provider dispatch), the two-process worker pattern (`scripts/dev.mjs`, `src/engine/loop.ts`).

## 10. Brand, positioning & copy rules

**Sell the decision, not the stack.** The buyer's alternative is not another tool — it's *guessing*: building for three months and finding out the hard way. That's the enemy in all copy.

- **Never** name or compare against AI tools/models anywhere on the site ("Perplexity", "ChatGPT", "GPT", "Claude" are banned strings in marketing copy). "AI-powered" must not appear in the hero or above the fold — in 2026 it's table stakes at best, slop-signal at worst. The differentiated claim is *"every source verified, or your money back."*
- AI appears at most in one quiet FAQ answer: *"How is it made? An analyst-grade research pipeline; every source is independently verified before delivery — that's the part we guarantee."*
- **Hero copy (use this, or equivalent in the same register):**
  > **"Find out if anyone will pay — before you build it."**
  > One idea in. Five sharper versions out — scored on 8 demand signals, with verified sources, real search volumes, named competitors, and the cheapest experiment to prove each one. In 10 minutes. Money-back if the evidence doesn't check out.
- Supporting lines: "Validation with receipts — every citation is a real link you can click." · "A kill criterion for every idea, so you stop before it costs you a quarter." · "What a good analyst would do in two days, for $29."
- **The sample report is the argument** — show, don't claim. It carries more conversion weight than any copy.
- Sell under **BurningDemand** only. cslopslop is a codename/show brand — it must not appear on the paid product (unprofessional to card-paying buyers).
- Required legal: Terms, Privacy (email stored for delivery; deletion on request), footer disclaimer: *"Research assistance, not financial or investment advice."*
- **Confidentiality:** this repo stays closed-source/private. The generation + validator prompts and (later) the Daily Burn discovery logic are trade secrets — never publish or open-source them. (Open-source lives on the cslopslop side — the engine spine + the `slop/` contract — per the portfolio strategy, and only after v0 revenue.) The generated-reports dataset is never shared or sold.

## 11. Roadmap (context only — later phases are NOT v0 scope)

The free/paid line across every phase: **the generic radar is free; *your* idea, fully analyzed with verified receipts, is paid.**

| Phase | Scope | Notes |
|---|---|---|
| **v0** (now, ~2 wks) | The paid one-shot report — exactly §5 | Revenue proof first. Nothing else ships until a stranger pays. |
| **v0.5** (+~1 wk) | **The Daily Burn** — automated daily scan → 1–5 FREE public opportunity *briefs*, email-list capture, auto-post to X | The distribution flywheel + show fuel. Discovery from licensed sources only: search-volume deltas (DataForSEO / Google Trends), rising HN threads (Algolia), PH launches, app-review pain clusters. A brief is the LITE format — 1 opportunity, 2 evidence links, scores without justifications, no keyword tables — **same evidence bar as paid, lighter body, never lower quality**. One public page per day (compounding SEO). Cost bound ≤ $5/day. No accounts. |
| **v1** | Accounts + freemium | Verified email → 1 free **lite** personal report (~$0.30 COGS, hard caps, disposable-email defense); credits + purchases attach to the account. |
| **v2** | **Demand monitoring** | User-defined niche/keyword/channel watchlists + alerts when signals spike — the natural subscription ($9–19/mo): monitoring is continuous where validation is episodic. |

v0.5+ are documented here so v0 leaves the right seams — the job worker generalizes to scheduled scans; the report renderer supports a `brief` variant — but the builder agent ships **v0 alone** first.

## 12. Non-goals (v0) — the builder must NOT add these

Accounts/logins (v1) · subscriptions (v2) · the Daily Burn feed (v0.5) · dashboards · an API · team seats · PDF generation (print CSS suffices) · free report generation (the public sample is static) · multi-language · the cslopslop platform features (building/deploying the companies) · fine-tuning/training.

## 13. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Fabricated/unverifiable evidence** (product-killing) | Critical | Grounded-only citation rule; URL liveness validation; independent validator gate; refund promise; store validation proof |
| Platform ToS (Reddit et al.) | High | §8: licensed providers only; the old scraper pipeline is retired |
| Provider dependency/outage (Sonar/DataForSEO) | Med | Abstraction seam per source; at least one fallback provider wired; degrade gracefully (report ships with fewer volume items, flagged) |
| Cost blowout per report | Med | Per-stage token caps; per-report cost tracking; $4 alert; staged small calls |
| Low conversion (no audience) | High | Not solved in-product: launch via build-in-public + PH; sample report is the funnel; $19 launch code; the Daily Burn (v0.5) is the compounding fix |
| Free-feed quality dilution (v0.5) | Med | Briefs pass the same evidence bar as paid — fewer items, never lower quality |
| Refund abuse / chargebacks | Low | One-shot low price; deliver value fast; auto-refund failures before disputes |
| Prompt injection / abusive input | Med | §7 delimiters + moderation pre-check |
| Deliverability (emails in spam) | Med | Resend with verified domain/DKIM; report link also shown on the post-checkout success page |
| LLM quality drift | Med | Prompts are versioned; validator gate catches regressions; sample-input regression test in CI |

## 14. Success metrics & kill criteria

- **Primary:** first paying (non-friend) customer within **30 days of launch**. Miss → reposition (per portfolio strategy).
- Report success rate ≥ 95% without manual retry; p95 delivery ≤ 10 min; refund rate < 5%; COGS ≤ $2; every shipped report passes URL validation 100%.

## 15. Launch checklist (agent-executable)

1. All 5 SKUs/flows tested with Stripe test cards (buy 1, buy 3, redeem credit, promo code, refund).
2. Generate 5 real reports on diverse ideas ("Snowflake clone", "Notion for lawyers", a consumer app, a hardware-ish idea, a vague one-worder) — hand-check every URL resolves and every name passes anti-echo.
3. Pick the best as the public sample report.
4. Domain live w/ SSL, DKIM/SPF verified, webhook signature verified in prod, `/healthz` monitored.
5. Kill-switch env var to pause sales (`SALES_PAUSED=1` → landing shows waitlist email capture).

---

**Definition of done for the builder agent:** a stranger can pay $29 on burningdemand.com, and ≤10 minutes later receive an emailed link to a report whose every citation resolves, produced with zero operator involvement — and the operator can refund any order with one Stripe click. Everything else is polish.
