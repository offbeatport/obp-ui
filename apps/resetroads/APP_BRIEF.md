# ResetRoads

## Niche

Mid-to-senior tech workers who just got laid off — need a clear, honest read on their next career move.

## Pain post

HN thread: "Ask HN: Got laid off — what now?"
Engineers facing a layoff need to make high-stakes decisions fast (take this offer? freelance? pivot?) with no impartial sounding board. Friends are biased; recruiters have an agenda; AI chat is too agreeable.

## Loop & monetization

- Retention loop: Share page at `/r/$slug` — users share their analysis, others see it and want one
- Monetization moment: Top Tier Debate requires a free account (email gate) → funnels to ColdVerdict paid
- Archetype: tool-first
- Style + Radius: Cobalt + Subtle — confident, data-forward, not consumer-y

## V1 features

- CV upload (PDF/DOCX) — text extracted server-side, file never stored
- Decision picker: offer/freelance/pivot/salary/other with optional JD or offer paste
- Profile extraction via OpenRouter (cheap model) — factual only, no invented scores
- CV vs JD gap analysis — present/partial/missing, no match percentage
- Fast Verdict: 3 cheap models debate via OpenRouter, renders inline
- Top Tier Debate: 3 frontier models, email gate after Round 1 preview
- Share page: public profile view at `/r/$slug`, private sections locked
- Owner cookie: httpOnly, identifies the original uploader

## Out of scope

- Salary estimates, demand scores, time-to-hire predictions — no real data source
- CV storage — only extracted text persists
- Paid tier in V1 — this is the top-of-funnel for ColdVerdict

## Risks

- PDF parsing quality — mitigation: use pdf-parse server-side, prompt user to review extracted profile
- OpenRouter cost — mitigation: fast tier is cheap models only, top tier requires email commitment

## Distribution

- HN Show HN post — manual
- Share page viral loop — built-in

## Success signal at 12 months

≥ 500 analyses run, ≥ 50 ColdVerdict signups attributed

## Deletion criteria (all four must hold)

- ≥ 12 months since launch
- Zero ColdVerdict referrals for 90 days
- Zero organic analyses for 90 days
- Hosting cost > $0 in observable value
