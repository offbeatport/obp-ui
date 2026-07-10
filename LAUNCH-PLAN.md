# 7-Day Launch Plan — BurningDemand + CSlopSlop

**Goal:** ship BurningDemand (BD, a multi-source demand-research tool / GummySearch replacement) and CSlopSlop (the agent-builds-companies platform), with a daily build-in-public content + distribution track. ~55.5h over 8 calendar slots (T-14 prep + Days 0–7), ~7h/day.

**Two decisions baked in:**
- BD's free tool launches **Day 2** so the "100 signups in 72h" gate resolves ~Day 5 — in time to inform the CSlop build.
- ProductHunt fires **Day 7** alongside HN/Reddit/X (single 7-day window).

**Kill-gate semantics:** the 72h gate kills BD *as a standalone product*, not the code. On a fail, BD folds into CSlopSlop as its opportunity-intake engine. Public framing is "or it becomes a feature," never "or I delete it."

| Day | Product | Build — task · hrs | Tweet (≈0.5h) | Distribution — task · hrs | Total |
|---|---|---|---|---|---|
| **T-14 (pre)** | — | — | — | Register + warm 3 Reddit + 2 HN accts (karma via genuine comments); list 15 accts + 5 subs · ~0.5h/day | — |
| 0 | Setup | Domains + landings, Stripe test, waitlist form, analytics, API keys (Grok/Perplexity/Claude) + caching/caps, allow GPTBot/PerplexityBot/ClaudeBot, X Premium, screen-recorder, disclaimer · 3h | — | Verify warmed accts; 1 value comment in r/SaaS · 1h | 4h |
| 1 | BurningDemand | Intake (Grok+Perplexity) → dedup → freq×intensity score; every claim cites a URL · 6h | "GummySearch died over Reddit's API — building the multi-source replacement. Day 1 [shot]" | Reply to 5; 1 value comment · 1h | 7.5h |
| 2 | BurningDemand | WTP extraction + MVP brief; **waitlist/Stripe-test + free single-keyword page (launch early)** · 6h | "Now it extracts willingness-to-pay + writes a build brief. Cost/report: $0.xx [clip]" | Native "I built a free tool" post + DM ex-GummySearch users · 1.5h | 8h |
| 3 | BurningDemand | Ship: gate full report; write kill/keep gate; **"100 signups in 72h or it becomes a feature"** · 5h | "Free tool live → [link]. 100 signups in 72h or it becomes a feature." | Reply to 5; answer a "how to validate an idea" thread · 1h | 6.5h |
| 4 | CSlopSlop | **1 style × 1 archetype** (shadcn) + in-repo `/design` spec → niche → landing + 5-feature skeleton (test-mode), e.g. "simple data lake (the 10% of Snowflake you use)" · 6h | "I have an AI that builds companies — so it's building my next one. [clip]" | Reply to 5; tease the loop · 1h | 7.5h |
| 5 | CSlopSlop | 2 GTM (SEO pages + approval-gated Reddit/X) + BD→CSlop "Build this" button · 6h | "BurningDemand found a niche → 1 click → CSlopSlop built landing+product+GTM [30s rec]" | **Read BD signup gate → keep/kill call;** line up PH/HN assets · 1h | 7.5h |
| 6 | CSlopSlop (+BD pages) | Integrate; dogfood CSlop to build BD's SEO/comparison pages; polish · 5h | "The whole loop, end to end. Own the repo, no lock-in. [best clip]" | Draft Show HN + Reddit + PH page; final acct warm-up · **1.5h (flex)** | 7h |
| 7 | Both — launch | Final polish + go-live · 2h | Launch thread (loop → BD → CSlop → what's not done → "what niche next?") | Fire together: X + Show HN + Reddit-native + PH; reply within 2h all day · 5h | 7.5h |

---

## T-14 (pre-sprint) — account warming
This is the single highest-leverage prep and **cannot be skipped or compressed**. Reddit and HN silently filter new/low-karma accounts; a Day-0-old account posting self-promo on Day 2 gets shadow-removed and you never see it.
- **Register 3 Reddit + 2 HN accounts** now. Spread them; don't post from one IP in a burst.
- **Earn real karma** — leave genuine, helpful comments (no links) in your target subs daily. Target ~50+ comment karma and 2+ weeks age per account before it posts anything promotional.
- **Build the target list:** 15 specific accounts to engage (ex-GummySearch users, indie-hacker voices, demand-research people) + 5 subreddits (r/SaaS, r/Entrepreneur, r/indiehackers, r/startups, plus one niche). Note each sub's self-promo rules and "I built X" tolerance.
- **~0.5h/day**, hands-off otherwise.

## Day 0 — Setup (Product: shared infra) · 4h
**Build (3h):**
- Buy domains; stand up two landing shells (BD + CSlop) with a **waitlist form** wired to a store you can query for the signup count.
- **Stripe test mode** keys in; confirm a test `payment_intent` reaches `succeeded`.
- **Analytics** with a clear funnel: traffic → landing view → signup. You must be able to separate "nobody came" from "people came and didn't convert" (this is what makes the kill-gate honest).
- **API keys** for Grok / Perplexity / Claude, behind a thin proxy with **response caching + spend caps** so a scrape loop can't run up a bill.
- `robots.txt` **allows GPTBot / PerplexityBot / ClaudeBot** (you want to be cited inside LLM answers — cheap long-tail traffic).
- **X Premium** (long posts + reach), a **screen recorder** (Day 1+ clips), and a **"not financial advice" disclaimer** on any output that reads as a recommendation.

**Distribution (1h):** confirm each warmed account still passes (not shadowbanned — check via a logged-out view); post 1 genuine value comment in r/SaaS.

## Day 1 — BurningDemand: intake + scoring (Product: BD) · 7.5h
**Build (6h):**
- **Intake:** pull demand signals from Grok + Perplexity for a keyword/topic (the multi-source angle is the whole pitch vs Reddit-only GummySearch).
- **Dedup:** collapse the same complaint expressed across sources into one item.
- **Score = frequency × intensity:** how often the pain shows up × how strongly it's expressed.
- **Every claim cites a source URL.** Non-negotiable — this is the trust differentiator and your defense against "the AI made it up."

**Tweet (0.5h):** "GummySearch died over Reddit's API — building the multi-source replacement. Day 1 [screenshot]."
**Distribution (1h):** reply to 5 target accounts; 1 value comment.

## Day 2 — BurningDemand: WTP + brief + **launch** (Product: BD) · 8h
**Build (6h):**
- **Willingness-to-pay extraction:** surface quotes/signals that someone would pay (existing paid tools mentioned, "I'd pay for", budget hints).
- **MVP brief:** auto-write a short build brief from the scored pains — this is the artifact that later becomes CSlop's "Build this" input.
- **Ship the free single-keyword page + waitlist/Stripe-test** — the tool goes **live today** so the 72h clock starts Day 2 and resolves ~Day 5.

**Tweet (0.5h):** "Now it extracts willingness-to-pay + writes a build brief. Cost/report: $0.xx [clip]." (The per-report cost number is a strong hook — show it.)
**Distribution (1.5h):** native "I built a free tool" post in your best sub; DM ex-GummySearch users individually with a specific reason it helps them.

## Day 3 — BurningDemand: gate + full report (Product: BD) · 6.5h
**Build (5h):**
- **Gate the full report** behind waitlist/signup (free single-keyword stays open as the hook).
- **Write the kill/keep gate logic:** count signups over the 72h window, and — critically — read it *alongside traffic* so you can tell a demand failure from a distribution failure.

**Tweet (0.5h):** "Free tool live → [link]. 100 signups in 72h or it becomes a feature." (Scarcity + honest — it never claims deletion.)
**Distribution (1h):** reply to 5; answer a "how do I validate an idea" thread with BD as the natural answer.

## Day 4 — CSlopSlop: template → skeleton (Product: CSlop) · 7.5h
**Build (6h):**
- **One shadcn style × one app archetype** (directory / dashboard / generic — pick the one this niche needs) + a niche → generates a **landing page + a 5-feature skeleton in test-mode.** Example niche: "simple data lake — the 10% of Snowflake you actually use."
- **Write the in-repo `/design` spec** (design tokens + component conventions) that the builder reads throughout the app's evolution so the UI stays coherent — the anti-slop artifact, and it *raises* the `doneWhen` pass-rate by shrinking the decision space. Agent-readable file (`slop/design/`), a dev-only route at most — not a public page.
- **Don't front-load the library.** Ship exactly one style + one archetype now; *extract* the reusable template from BurningDemand once it works, then grow (2–3 styles, 2 archetypes) from real apps. User style-switch = swap a shadcn CSS-variable token file (later).
- This is the riskiest estimate in the plan (see Day 6 flex). Timebox hard; a rough skeleton that runs beats a polished one that doesn't.

**Tweet (0.5h):** "I have an AI that builds companies — so it's building my next one. [clip]."
**Distribution (1h):** reply to 5; tease the loop.

## Day 5 — CSlopSlop: GTM + bridge + **gate call** (Product: CSlop) · 7.5h
**Build (6h):**
- **2 GTM motions:** auto-generated SEO pages + approval-gated Reddit/X posts (the message-actions from the spec — always human-approved).
- **BD → CSlop "Build this" button:** BD's MVP brief becomes CSlop's input in one click. This is the money shot that ties the two products into one loop.

**Tweet (0.5h):** "BurningDemand found a niche → 1 click → CSlopSlop built landing+product+GTM [30s rec]."
**Distribution (1h):** **Read the BD signup gate and make the keep/kill call** (traffic-adjusted). Line up PH + HN assets (images, copy, first comment).

## Day 6 — Integrate + dogfood (Product: CSlop, +BD pages) · 7h
**Build (5h):**
- Integrate the two products end-to-end; **dogfood CSlop to build BD's own SEO/comparison pages** (proof the loop works on a real product — the best possible demo).
- Polish the launch path only; ignore everything not on the demo route.

**Tweet (0.5h):** "The whole loop, end to end. Own the repo, no lock-in. [best clip]."
**Distribution (1.5h — FLEX):** draft Show HN title + Reddit post + PH page; final account warm-up. **This is your only slack** — if Day 4/5 build slipped, cut this to 0.5h and recover the build hours here.

## Day 7 — Launch (Product: both) · 7.5h
**Build (2h):** final polish + go-live. No new features today.
**Tweet:** the launch thread — loop → BD → CSlop → what's honestly *not* done yet → "what niche should it build next?" (the open question drives replies).
**Distribution (5h):** fire **X + Show HN + Reddit-native + PH together.**
- **Spend your first ~2h fully on ProductHunt's 00:01 PT window** — reply to every comment, don't touch the other channels yet. PH ranking is engagement-velocity-driven in the first hours; splitting attention here is the most expensive mistake.
- Then HN + Reddit + X, reply within 2h all day.

---

## Budget — spending a few hundred USD wisely

**Rule:** money that improves *what people see* (video, a working demo) or *buys time* is worth it; money that *fakes traffic or signal* is negative-value here.

**Cold ads actively harm this plan.** The 72h kill-gate is a *demand test* — organic signups mean real interest. Paying for traffic into that window makes genuine demand indistinguishable from purchased clicks, corrupting the one measurement the sprint is built on. Keep paid acquisition and the demand test apart.

**Spend here (ranked by ROI):**
1. **Production quality (~$90) — best money you'll spend.** A real screen-recorder/editor (Screen Studio one-time, or Descript). Every tweet is a clip; polished clips 3–5× engagement. Multiplies the entire organic track for a flat fee.
2. **COGS / API credits (~$50–150).** Grok + Perplexity + Claude calls are the product. Budget enough to run it reliably during the demo and to pre-generate 3–5 genuinely impressive example reports so first-visitors see it working, not an empty box. Show the real per-report cost — best hook.
3. **A "launch squad," not an ad budget ($0).** 5–10 real people lined up (DMs, group chat) to genuinely engage in PH/HN's first hour. Engagement *velocity* is what ranks you — beats any paid channel. Arrange during Day 5–6 slack.
4. **Held-back ~$100 "amplify the winner" reserve.** Boost an X post *only after* it's already going organically — expand reach on a proven tweet, never a cold one. Decide on launch day.

**Do NOT spend on:**
- **Reddit promoted posts / X cold ads / Google / Meta** — indie-SaaS conversion is poor; native posts crush ads for this audience. You'd pay $200 to learn your landing converts at ~0.5% and know nothing about why.
- **Bought followers / upvotes / PH hunters / aged accounts** — bannable, and it kills "honest & reliable," which is literally CSlopSlop's stated moat. Non-negotiable no.
