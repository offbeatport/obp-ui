# 2-Week Plan — CSlopSlop builds BurningDemand (the true dogfood)

**The bet:** don't hand-build BurningDemand. Build **CSlopSlop's build-loop** and make BD its **first company** — so *"CSlopSlop built BurningDemand"* becomes a **true** claim. That claim is the entire anti-Polsia proof from SPEC ("no `done` without live + proven"). BD is not a side product; it's CSlopSlop's **acceptance test**.

**Autonomy bar: loop-with-steering.** CSlopSlop's loop does the load-bearing work — generates the code, deploys to a live URL, validates `doneWhen` — while you steer heavily and approve every ship. That is honest to call *"built with CSlopSlop."* Fully-unattended (L2) is the destination, not this fortnight.

**Scope discipline (kills "it's too much"):** BD is the **forcing function**. Build *only* the loop BD's next feature needs. Every engine capability is justified by "BD needs it" — nothing speculative.

**Deadline: 2 weeks, but flex to protect quality.** The **CSlopSlop spine is the prize**; BD scope flexes. **Day 7 is the hard go/no-go** — if the spine can't ship one action reliably, Week 2 waits and you keep hardening. Don't fake the claim to hit a date.

**Two tracks run in parallel all fortnight:** engineering (you) + a light **demand-validation thread** (refugee interviews) so BD has real substance by the time the loop builds it.

**Distribution ownership — the extended dogfood:** CSlopSlop doesn't just *build* BD, it *markets* it.
- **CSlopSlop account = you, manual (the hub).** CSS is the platform, not a company inside itself, so its own GTM can't be automated — you run it by hand. Your narrative *documents CSS running BD's distribution*, so watching the machine market its company **is** your CSS content (the recursion feeds itself).
- **BurningDemand account = CSlopSlop-drafted, you-approve (the spoke).** BD's distribution actions come from CSS.
- **draft-not-send:** per the autopilot rule, every `message` action waits for you. CSS decides channel + writes the draft + times it; **you approve and post.** Don't build posting-API integration in 2 weeks — the honest, load-bearing automation is the acquisition **`code` actions** (SEO/comparison pages CSS *writes and deploys*); social drafts are the softer half.
- **channel-appropriateness (or it backfires):** CSS-drafted content is fine for **SEO pages, comparison pages, scheduled X**. It's a **liability on native Reddit/HN**, where communities remove AI marketing slop — **keep those human-written by you** (also protects your warmed accounts).
- **It doesn't beat the attention clock:** CSS automates the *supply* of distribution, not the *demand-side* reaction. The megaphone is automated; the listeners still move on their own time.

---

## Week 1 — Build the CSlopSlop spine (BD is just the hardcoded test target)
Goal: the loop takes one `code` action → builds via `claude -p` in the company repo → deploys to a real `localhost` URL → validates `doneWhen` against that URL → surfaces diff+preview+green check → you approve. Proven end-to-end on **one** hardcoded BD action. This is literally SPEC v1 step 1.

| Day | Engine task (SPEC ref) · hrs | Content (build-in-public, ≈0.5h) | Validation / Distribution · hrs | Total |
|---|---|---|---|---|
| **Pre** | — | — | Warm 3 Reddit + 2 HN accts; line up 5–8 ex-GummySearch interviews · ~0.5h/day | — |
| 1 | **Schema** — real 5 tables (opportunity·company·action·run·message), boot-time `CREATE TABLE`; company-repo bootstrap (bare git + `slop/` + `AGENTS.md`) · 6h | "Building the machine that builds companies. Day 1: the schema + a company = a git repo you own. [shot]" | 2 refugee interviews · 1.5h | 8h |
| 2 | **Run executor v0** — spawn `claude -p` in a company repo from an action (`title`+`doneWhen`), capture diff, commit; stream logs (SSE); record `costUsd` · 7h | "First agent-written diff, committed to a real repo. [clip]" | 1 interview · 1h | 8.5h |
| 3 | **Deploy seam** — company boots in a local container/dev server with a real `localhost` URL · 6h | "It deploys itself to a live URL now — nothing counts until it's live." | 2 interviews · 1.5h | 8h |
| 4 | **Validation contract** — a runner *distinct from the builder* hits the URL, checks `doneWhen`, green/red, retry→`blocked` (never auto-pass) · 6h | "The part Polsia skips: it validates against the live URL before it's allowed to say 'done'. [clip]" | Reply to 5; answer a "GummySearch alternative?" thread · 1h | 7.5h |
| 5 | **Approval gate + queue** — one screen: action = diff + preview URL + green check → Approve / Reject-with-feedback; pull top-priority ready action · 6h | "One screen. Preview + evidence + Approve. That's the whole app. [30s rec]" | Reply to 5 · 1h | 7.5h |
| 6 | **Prove the spine** — hardcode ONE BD action ("visitor can sign up on a live local URL"); run end-to-end **10×**; measure cold-run reliability · 6h | "10 cold runs of the full loop. Here's the honest score. [numbers]" | Native "building the GummySearch replacement in public" post · 1.5h | 8h |
| 7 | **BUFFER + harden to ≥7/10 — GATE + FLEX POINT** · 3–5h | "What broke over 10 runs and what I fixed. [honest recap]" | Reply to 5 · 1h | ~5h |

**Day 7 gate:** the loop must ship the hardcoded action **≈≥7/10 cold runs** (SPEC's own bar). Green → Week 2. Red → **this is where the flex lives:** keep hardening, slip Week 2, launch later. A shaky spine that "sort of" builds BD is the one outcome that makes the claim dishonest — don't ship past a red gate.

## Week 2 — CSlopSlop builds BurningDemand (loop-with-steering) + launch
Now BD stops being hardcoded. You seed it as a real company and the loop builds it feature by feature, you steering and approving each.

| Day | Loop-builds-BD task · hrs | Content (build-in-public) | Validation / Distribution · hrs | Total |
|---|---|---|---|---|
| 8 | Seed BD: thought → promote → **planning run** decomposes BD into `code` actions (skeleton first); `slop/spec.md` from the thesis. Loop builds **feature #1 (multi-source intake)**; you approve · 7h | "I gave it one sentence. Watch it plan the company and ship feature #1. [clip]" | 1 interview → founding-customer pipeline · 1h | 8.5h |
| 9 | Loop builds **scoring (freq×intensity + every claim cites a URL)** + **WTP extraction** as `code` actions; approve each · 6h | "Feature #2 and #3, shipped by the machine, each with a green check. [clip]" | Reply to 5 · 1h | 7.5h |
| 10 | Loop builds **free single-keyword page + report gating**; **soft-launch the free tool**; add **monetize action** ("user can pay", real Stripe) + pricing · 6h | "Free tool live — built by the machine, not me. [link]" | Native post + DM refugees · 1.5h | 8h |
| 11 | Loop builds **SEO / "GummySearch alternative" comparison pages** (acquisition `code` actions) + **`message` action path (CSS drafts BD's X/build-in-public posts → you approve → you post)** + polish; **chase first paying customer** · 6h | "It wrote its own comparison page *and* its launch posts. And someone just paid. [screenshot]" | DM warm contacts (founding offer); post CSS-drafted BD content to BD's account · 2h | 8.5h |
| 12 | **BUFFER** — integrate, harden the demo path, dry-run checkout end-to-end; cut the **killer launch asset: a clean loop-ships-a-feature video** · 3–4h | "Tomorrow. What the machine built, and what I hand-finished. [teaser]" | Confirm launch squad (5–10 real people) · 1h | ~5h |
| 13 | **LAUNCH both** — go-live + monitor, hotfix only · 2h | Launch thread: *the machine → the company it built (BD) → live + paid → "what should it build next?"* | Fire **PH (00:01 PT, first 2h fully on PH)** → HN + Reddit-native + X; reply all day · 6h | 8.5h |
| 14 | **Follow-through + honesty ledger** — fix top launch issues; write the 30-day backlog from feedback · 3h | Bridge post + **publish which features the loop built vs which you hand-finished** (the honesty ledger *is* content) | Reply to every comment; convert BD audience → CSlopSlop waitlist; thank the squad · 2.5h | 6h |

---

## Gates
- **Day 2 (demand) —** ≥5 interviews confirm the pain is real and payable. If not, fix BD's wedge before the loop builds the wrong thing.
- **Day 7 (spine) — HARD.** Loop ships one action ≈≥7/10 cold. Red → flex/extend; do not proceed.
- **Day 11 (real dollar) —** one ex-GummySearch user pre-pays. Softer here (the headline is CSlopSlop), but a real dollar makes the proof undeniable.
- **Every ship (honesty) —** only features that actually ran through the loop count toward "CSlopSlop built it." Track them; publish the split on Day 14.

## The honesty rule (your entire moat)
- Say: *"CSlopSlop built BurningDemand — I directed it, approved every ship, and it wrote and validated the code against a live URL."* True and compelling.
- Never say: *"fully autonomous / no human involved"* (it wasn't) or credit the loop for features you hand-coded.
- The **honesty ledger** on Day 14 (loop-built vs hand-finished) turns your one vulnerability into your most credible content — the opposite of Polsia's "marked done but never deployed."
- **Extends to distribution:** say *"CSlopSlop wrote BD's SEO pages and drafted its posts; I approved and posted them."* Never imply the machine posted autonomously (it didn't — draft-not-send). Two accounts stay separate & real: CSS = you; BD = CSS-drafted. No sockpuppets.

## Content thread — the demo *is* the marketing
The killer build-in-public asset isn't "I built a thing" — it's **watching a machine ship a real company's feature end-to-end**: diff → live preview → green `doneWhen` → your approve. Capture one clean clip per feature (Days 8–11). No competitor can fake this because faking it *is* the thing they get caught doing.

## Reality check
- **Hardest part:** Week 1. You're building a novel agent build-platform from a bare shell. If any single engine piece (deploy seam or `doneWhen` validation) fights you, it eats Day 7's buffer and pushes launch — that's the expected, acceptable outcome under "flex to protect quality."
- **Discipline that saves the plan:** build *only* what BD's next feature needs (scope), and protect the **spine** over BD's breadth (if forced to choose, ship fewer BD features that the loop *truly* built over more that you hand-finished).
- **Don't** let BD's product polish pull you into hand-coding it in Week 2 — the moment you do, you're back to two hand-built products and the claim dies.
- **If Week 2 slips, cut the `message`-action path first.** CSS *writing and deploying* BD's SEO/comparison pages is the real, load-bearing distribution proof; auto-drafted social posts are the softer half — drop them to hand-written before you touch the acquisition `code` actions. Keep native Reddit/HN human-written regardless.

## Budget
Same rules as `LAUNCH-PLAN.md` (production quality + COGS/API credits + launch squad + held-back "amplify the winner" reserve; **no cold ads into the demand gate**). Extra COGS line here: the loop itself spends tokens building BD — fund enough `claude -p` runs to build *and* re-run rejected attempts without rationing.
