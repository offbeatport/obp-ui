# ResetRoads

Built on `@offbeatport/microsaas-core`. All factory rules: [`../../FACTORY.md`](../../FACTORY.md).

- Archetype: tool-first
- Niche slot: `src/lib/cv-parser.ts` (CV extraction) + `src/lib/debate.ts` (multi-model debate)
- Style + Radius: Cobalt + Subtle (custom CSS from design — see src/styles/app.css)

Per-app overrides:

- CV files are processed server-side and never stored — only extracted text is saved
- Share pages (`/r/$slug`) are public; ownership is checked via httpOnly cookie `rr_own_<slug>`
- Fast debate uses cheap OpenRouter models; Top Tier uses frontier models behind an email gate
- No fake scores, no invented salary data — only factual extraction from the CV itself
- Debate output is clearly labelled as AI opinion, not fact
