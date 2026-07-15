# TODO

Deferred work — things pulled out of the product for now, to revisit later.

## Spin flow (start a company)

- [ ] **"Surprise me" button** — auto-start a spin from a random/curated thought so the founder
      can watch the flow with zero input. Removed from the `/companies/new` composer for now
      (`src/routes/companies/new.tsx`); the `LUCKY_THOUGHTS` list + `lucky()` handler were the
      implementation. Re-add when the flow is polished enough to demo cold, and ideally have the
      engine pick the thought (scan trends) rather than a hardcoded list.
