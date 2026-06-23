# LiveAIPulse

Built on `@offbeatport/microsaas-core`. All factory rules: [`../../FACTORY.md`](../../FACTORY.md).

- Archetype: directory (public leaderboard + admin backend)
- Niche slot: `src/lib/openrouter.ts` (AI query + domain extraction) + `src/lib/seed.ts` (predefined queries)
- Style + Radius: Azure + Sharp

Per-app overrides:

- Admin is gated by ADMIN_USERS env var (comma-separated emails), not a role in DB
- No paid tier in V1 - this is the hypothesis test build
- Run processing is fire-and-forget via setTimeout after API response
- Rankings table is upserted after each run - domain + categoryId is the unique key
