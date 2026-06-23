# Factory canon

Single source of truth for offbeatport's micro-SaaS factory. If something is documented elsewhere, that elsewhere is wrong - fix it or delete it.

Three files are kept outside this doc for mechanical reasons only:

- `packages/core/src/theme/styles.ts` - values must compile (picker copy lives in §2).
- `~/.claude/skills/build-from-pain/SKILL.md` - must live in the skills dir; thin pointer to §7 + §8.
- `~/.claude/projects/.../memory/MEMORY.md` - auto-load mechanism is path-bound; one-line pointer to this file.

## Contents

0. [Quick start](#0-quick-start)
1. [Layered .env model](#1-layered-env-model)
2. [Style + Radius](#2-style--radius)
3. [Composition rules](#3-composition-rules)
4. [Archetypes](#4-archetypes)
5. [Shared pages](#5-shared-pages)
6. [Anti-slop gate](#6-anti-slop-gate)
7. [Idea-quality gate](#7-idea-quality-gate)
8. [Scaffold flow](#8-scaffold-flow)
9. [APP_BRIEF template](#9-app_brief-template)
10. [Per-app CLAUDE.md](#10-per-app-claudemd)

---

## 0. Quick start

```bash
pnpm install              # install everything (workspace-aware)
pnpm --filter <slug> dev  # start a specific app
pnpm --filter <slug> typecheck
pnpm --filter <slug> db:push
```

To scaffold a new app from a pain post: invoke `/build-from-pain`. It follows §7 (idea gate) and §8 (scaffold flow).

---

## 1. Layered .env model

Two files. Vite's `loadEnv` merges them; per-app `.env` overrides shared on key collision.

**Layer 1 - `<monorepo>/.env.shared`** (gitignored). Shared provider keys:

```
RESEND_API_KEY=
OPENROUTER_API_KEY=
POLAR_ACCESS_TOKEN=
POLAR_ORGANIZATION_ID=
```

**Layer 2 - `apps/<slug>/.env`** (gitignored per app). Must stay unique per app:

```
BETTER_AUTH_SECRET=   # shared = cross-app session bleed
DATABASE_URL=./app.db # shared = all apps in one file
BETTER_AUTH_URL=      # different domain per app
VITE_SENTRY_DSN=
VITE_POSTHOG_KEY=
POLAR_PRODUCT_IDS=
POLAR_WEBHOOK_SECRET=
```

**For Coolify deploy:** layer-1 maps to a Coolify "Environment Group"; layer-2 is set per-application.

**Never** duplicate a layer-1 key into a per-app `.env.example` - it drifts as keys rotate.

### Platform-only secrets (third tier)

Factory infrastructure apps (e.g. `platform/control/`) need credentials that must not leak into product apps. Keep them only in that app's `.env`:

```
# === Platform-only - DO NOT COPY TO OTHER APPS ===
COOLIFY_API_TOKEN=
POLAR_ORG_ADMIN_TOKEN=
SEARCH_CONSOLE_SERVICE_ACCOUNT=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
```

---

## 2. Style + Radius

Default: **Cobalt + Subtle.** Source of truth: `packages/core/src/theme/styles.ts`.

### 14 Styles

| #   | Style     | Light primary / bg    | Dark primary / bg     | When                              |
| --- | --------- | --------------------- | --------------------- | --------------------------------- |
| 1   | Cobalt    | `#3B5BDB` / `#FAFAF7` | `#6B86FF` / `#0E0E0F` | universal trust - safe default    |
| 2   | Emerald   | `#047857` / `#FAFAF7` | `#34D399` / `#0B1020` | fintech / health / "go signal"    |
| 3   | Tangerine | `#FF6B00` / `#FFFBF5` | `#FF9447` / `#15110D` | e-commerce / dev tools (high CTR) |
| 4   | Azure     | `#0369A1` / `#EEF2FB` | `#38BDF8` / `#0E0E0F` | data / analytics / B2B            |
| 5   | Royal     | `#4338CA` / `#F5F1E8` | `#818CF8` / `#0B1020` | premium B2B                       |
| 6   | Editorial | `#3B4A6B` / `#F5F2EC` | `#7C8DAE` / `#0A0E14` | high-AOV / craftsperson tool      |
| 7   | Mono      | `#475569` / `#FAFAF7` | `#94A3B8` / `#0E0E0F` | dev tools / minimal premium       |
| 8   | Pine      | `#166534` / `#EEF6EC` | `#4ADE80` / `#0E0E0F` | health / organic / sustainability |
| 9   | Teal      | `#0D9488` / `#FAFAF7` | `#2DD4BF` / `#0E0E0F` | productivity / collaboration      |
| 10  | Iris      | `#6750A4` / `#F2EBFA` | `#9C8AE8` / `#0E0E0F` | creative tools                    |
| 11  | Plum      | `#7C2D8C` / `#FAFAF7` | `#BC6BC9` / `#0B1020` | premium consumer / lifestyle      |
| 12  | Scarlet   | `#FF0000` / `#FFF`    | `#FF0000` / `#000`    | media / entertainment only        |
| 13  | Dusk      | `#6E2470` / `#EFE9D9` | `#B077B3` / `#1A0D1B` | editorial niche                   |
| 14  | Moss      | `#55624C` / `#F2F0EB` | `#9CAF88` / `#0F1410` | craft / artisan / very niche      |

Avoid Tangerine and Scarlet for finance, healthcare, or any serious-tool niche.

### 5 Radius presets

| Name   | sm  | md  | When                              |
| ------ | --- | --- | --------------------------------- |
| Sharp  | 0   | 0   | dev tools, premium B2B, editorial |
| Subtle | 4   | 8   | **default** - generic SaaS        |
| Round  | 8   | 12  | consumer, e-commerce, creative    |
| Plump  | 12  | 16  | high-CTR consumer                 |
| Pill   | 999 | 24  | playful / lifestyle (rare)        |

### Token contract

Tokens are RGB triplets (`59 91 219`, not `#3B5BDB`). Write the full triplet in three CSS blocks:

```css
:root {
  --primary: 59 91 219;
  --primary-fg: 255 255 255;
  --bg: 250 250 247;
  --r-sm: 4px;
  --r-md: 8px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --primary: 107 134 255;
    --primary-fg: 14 14 15;
    --bg: 14 14 15;
  }
}
:root[data-theme="dark"] {
  --primary: 107 134 255;
  --primary-fg: 14 14 15;
  --bg: 14 14 15;
}
```

Never write hex values in component code. Use semantic tokens (`text-fg-muted`, `bg-hover`) or add a new token.

---

## 3. Composition rules

Rules, not guidelines. Break one only by changing the rule first.

**3.1 Structure with type + space, not chrome.**

- Max-width: `max-w-2xl` reading, `max-w-3xl` forms/tools, `max-w-4xl` dashboards, `max-w-5xl` multi-column.
- Vertical rhythm: `py-10`–`py-16` between sections.
- One `<h1>` per route. `CardTitle` only inside a Card surface.

**3.2 Cards are not the default container.** Use a bordered/shadowed `<Card>` only when the thing is a form with submit affordances, a lifted surface by metaphor (dialog, pricing tile), or an interactive peer tile needing hit-target affordance. Everything else renders flat.

**3.3 Every state must be visible.** Empty / loading / error / success. Use `EmptyState`, `LoadingState`, `ErrorState`. Missing states is the #1 thing §6 catches.

**3.4 Animation: serve attention, don't seek it.** `animate-in fade-in-0 slide-in-from-top-2` for entrances. Max 200ms. Skip on `prefers-reduced-motion`.

**3.5 No em-dashes in generated content.** Never use em-dashes (-) in UI copy, labels, descriptions, marketing text, or error messages. Use a hyphen, a comma, or rewrite the sentence. Em-dashes are a known AI writing tell.

---

## 4. Archetypes

7 layout shapes. Pick one whose loop matches the brief.

Common to all:

- `idCol`, `timestamps` from `@offbeatport/microsaas-core/db/columns`.
- Auth tables via `createDb({ schema })` - never redeclare.
- Use `(createFileRoute("...") as any)({ server: { handlers: { POST: async ({ request }: { request: Request }) => {} } } })` for API routes.
- UI from `@offbeatport/microsaas-core/ui`.
- Server-only modules (db, auth, secrets) imported dynamically inside handlers - never at module top of a route file.
- `VITE_` prefix for any env var the browser reads.

### Picker

| Loop                                             | Archetype    |
| ------------------------------------------------ | ------------ |
| AI/computed output from a single input           | `tool-first` |
| Multi-step flow that exports a paid artifact     | `wizard`     |
| Returning user with persistent data + many views | `classic`    |
| Watch-something-and-notify-me                    | `alert`      |
| Daily-check-the-numbers                          | `dashboard`  |
| Embed-on-customer-site                           | `widget`     |
| Curated listings + paid submissions              | `directory`  |

### 4.1 tool-first

> Hero IS the tool. Anon N free uses → soft paywall (save/export) → hard paywall (login) → paid (unlimited).

| Path                  | Auth         | Purpose                                  |
| --------------------- | ------------ | ---------------------------------------- |
| `/`                   | anonymous    | Hero with the tool inline.               |
| `/api/run`            | rate-limited | Anon: 3/day, free: 10/day, paid: 1k/day. |
| `/dashboard`          | required     | Run history.                             |
| `/dashboard/$runId`   | required     | Run detail / re-run / export.            |
| `/login`, `/pricing`  | anonymous    |                                          |
| `/api/auth/$`         | n/a          | better-auth catch-all.                   |
| `/api/webhooks/polar` | n/a          | Polar → upgrade tier.                    |

```ts
export const runs = sqliteTable("runs", {
  id: idCol(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  anonId: text("anon_id"),
  input: text("input", { mode: "json" }).notNull(),
  output: text("output", { mode: "json" }).notNull(),
  ...timestamps,
});
```

**Gotchas:** Rate-limit by IP + cookie + user. Server enforces tier. Stream AI responses. Don't gate the first impression.

### 4.2 wizard

> Step-by-step flow ending in paywalled artifact. Watermarked preview free; full version paid.

| Path                  | Auth      | Purpose                                             |
| --------------------- | --------- | --------------------------------------------------- |
| `/`                   | anonymous | Landing → "Start" CTA.                              |
| `/build/$step`        | anonymous | Wizard steps; state in URL or cookie.               |
| `/build/result`       | anonymous | Watermarked preview + paywall CTA.                  |
| `/api/preview`        | n/a       | Returns watermarked artifact (free).                |
| `/api/generate`       | n/a       | Returns full artifact (paid; checks `builds.paid`). |
| `/checkout/success`   | anonymous | Polar redirect → triggers full download.            |
| `/api/webhooks/polar` | n/a       | Mark `builds.paid = true` by `metadata.buildId`.    |

**Gotchas:** Paywall always at the END. Watermark baked into output, not CSS. Server validates `builds.paid`.

### 4.3 classic

> Marketing → signup → dashboard. Standard B2B SaaS.

| Path                         | Auth      | Purpose                           |
| ---------------------------- | --------- | --------------------------------- |
| `/`, `/features`, `/pricing` | anonymous | Marketing.                        |
| `/login`, `/signup`          | anonymous | better-auth.                      |
| `/dashboard`                 | required  | Primary authenticated experience. |
| `/dashboard/$resource`       | required  | Resource CRUD pages.              |
| `/dashboard/settings`        | required  | Profile, billing, integrations.   |
| `/api/auth/$`                | n/a       | better-auth.                      |
| `/api/webhooks/polar`        | n/a       | Set user tier.                    |

**Gotchas:** Never gate `/pricing`. Empty-state design determines activation. Self-serve cancellation only.

### 4.4 alert

> Setup-and-forget. The notification IS the product.

| Path                    | Auth     | Purpose                                   |
| ----------------------- | -------- | ----------------------------------------- |
| `/dashboard`            | required | Monitor list + recent alerts.             |
| `/dashboard/new`        | required | First-monitor onboarding wizard.          |
| `/dashboard/$monitorId` | required | Monitor detail / history / edit.          |
| `/api/check`            | n/a      | Cron-only; auth via `CRON_SECRET` header. |
| `/api/auth/$`           | n/a      |                                           |
| `/api/webhooks/polar`   | n/a      |                                           |

**Gotchas:** Real cron platform (Vercel Cron, QStash) - not in-process timers. Dedup notifications by hashed payload. Exponential backoff on flapping targets.

### 4.5 dashboard

> Data-heavy daily-use. Charts, tables, filters.

| Path                  | Auth     | Purpose                     |
| --------------------- | -------- | --------------------------- |
| `/dashboard`          | required | Charts + recent records.    |
| `/dashboard/log`      | required | Quick-add form.             |
| `/dashboard/history`  | required | Filterable/sortable table.  |
| `/dashboard/insights` | required | Aggregates / trends.        |
| `/dashboard/export`   | required | CSV / JSON download (paid). |

**Gotchas:** Cold start = high churn - seed sample data. Mobile-first quick-add. Always scope queries by `userId`.

### 4.6 widget

> JS snippet customers paste on their site.

| Path                           | Auth     | Purpose                      |
| ------------------------------ | -------- | ---------------------------- |
| `/dashboard`                   | required | Site list + install snippet. |
| `/dashboard/$siteId/customize` | required | Theme, copy, behavior.       |
| `/dashboard/$siteId/analytics` | required | Stats.                       |
| `/embed.js`                    | public   | Widget bundle. Cache hard.   |
| `/api/widget/config/$siteKey`  | public   | Domain-allowlisted config.   |
| `/api/widget/event`            | public   | Telemetry beacon.            |

**Gotchas:** `embed.js` < 10 KB gzipped - no React. Domain-allowlist the config endpoint. "Powered by AppName" IS your distribution.

### 4.7 directory

> Curated listings + search + paid submissions. SEO-compounding.

| Path                  | Auth      | Purpose                                    |
| --------------------- | --------- | ------------------------------------------ |
| `/`                   | anonymous | Browse + search + featured.                |
| `/category/$slug`     | anonymous | Category landing (SEO).                    |
| `/$listingSlug`       | anonymous | Listing detail (the SEO money page).       |
| `/submit`             | anonymous | Submission form.                           |
| `/dashboard`          | required  | Submitter's listings + analytics.          |
| `/admin`              | admin     | Curation queue. Gated by `ADMIN_USER_IDS`. |
| `/api/webhooks/polar` | n/a       | Mark featured listing paid.                |

**Gotchas:** SEO is the product - unique title, meta, JSON-LD, OG per listing. Sitemap + IndexNow ping on approval. Never auto-publish submissions.

---

## 5. Shared pages

Import from core, pass props, never fork the legal copy.

| Component            | Import path                                    | Key props                 |
| -------------------- | ---------------------------------------------- | ------------------------- |
| `<PrivacyPolicy />`  | `@offbeatport/microsaas-core/pages/privacy`    | `appName`, `contactEmail` |
| `<TermsOfService />` | `@offbeatport/microsaas-core/pages/terms`      | same                      |
| `<PricingPage />`    | `@offbeatport/microsaas-core/pages/pricing`    | `tiers`, `faq?`           |
| `<NotFoundPage />`   | `@offbeatport/microsaas-core/pages/not-found`  | `homeHref`                |
| `<ErrorPage />`      | `@offbeatport/microsaas-core/pages/error-page` | `error`, `onRetry?`       |

Extra clause needed? Pass `additionalSections={[{ title, body }]}`. Don't fork base content.

---

## 6. Anti-slop gate

Run twice: against the brief before building, against the implementation after. Fix every blocking item.

### Brief gate

- Audience is specific enough to shape product decisions.
- Core job is one sentence describing a real task, not a category.
- Archetype matches the product loop.
- Retention loop is explicit (repeat use / notification / SEO / embed / saved workflow).
- Monetization point matches the moment of value.
- Data model uses domain language, not generic `items`.
- Niche slot is named (processor, generator, check, tracker, widget behavior, listing rules).

### Implementation gate

- First screen exposes the product, not a generic marketing placeholder.
- Labels, examples, empty states, and CTAs are niche-specific.
- Main workflow completes with realistic inputs.
- Loading, error, empty, and success states are all implemented.
- No fake analytics, fake AI output, fake charts, or inert buttons.
- Routes, DB tables, env vars, and handlers match the selected archetype (§4).
- Auth and paywall checks are enforced server-side.
- App imports shared UI/core utilities instead of copying core code.
- No references to previous apps, placeholder names, or scaffold instructions in UI.
- Paid feature is useful, not a random upgrade CTA.
- Layout follows §3 - lists and content blocks render flat.

### Shipping gate

- `pnpm --filter <slug> typecheck` passes clean.
- Concrete deploy/env checklist exists.
- Brief and implementation still agree.
- Main path walked once manually.

---

## 7. Idea-quality gate

Used by `/build-from-pain`. Reject ideas that fail any MUST or hit any AVOID.

### MUST

- 10/10 or don't ship. If you can't find one, exit.
- Weirdly addictive (users come back / share / embed).
- Targets users with money, not cheap users.
- Legally clean - no licenses, regulated activity, risky compliance.
- Low-touch after launch: "build once, maintain never."
- Clear path to mid-high revenue.
- Connects directly to ROI: revenue gain, cost saving, risk reduction, or time saved.
- Easy to explain in one sentence including why it solves the pain.
- Addresses a less obvious underlying need, not just a surface feature.
- Self-growth loop named in one sentence (product loop, SEO, embeds, referrals, team spread). If you can't name it, fail.
- Perfect for a lazy founder.

### AVOID

- Depends on consulting, sales-heavy services, or manual fulfillment.
- Could harm, demean, exploit, or manipulate users.
- Betting / gambling mechanics.
- Complex back-office logic before anything feels useful.
- On the user's critical path (they must be OK with 90% accuracy or brief downtime).

---

## 8. Scaffold flow

### 8.1 Pre-flight

- Verify `apps/<slug>/` does not exist.
- Verify `platform/templates/<archetype>/` exists. Currently available: `tool-first`. Others must be built from scratch per §4.x.

### 8.2 Copy template

Templates are real running apps - no placeholders, no stubs. Copy and customise:

```
cp -r platform/templates/<archetype>/ apps/<slug>/
```

Then in `apps/<slug>/`:

1. Rename `name` in `package.json` to `<slug>`
2. Copy `_env.example` → `.env`, fill in secrets (generate `BETTER_AUTH_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
3. Rename `_gitignore` → `.gitignore`
4. Run `pnpm install`

### 8.3 Customise

The template is already running. Three things to change:

| What            | Where                                                |
| --------------- | ---------------------------------------------------- |
| Feature logic   | `src/features/index.ts` - replace `processFiles()`   |
| Branding + copy | `src/routes/index.tsx` headline, subtitle, CTA text  |
| Style + Radius  | `src/styles/app.css` - 3-block token override per §2 |

Everything else (auth, rate limiting, DB, dashboard, run history, pricing shell) works out of the box.

### 8.4 Apply Style + Radius

Default is Cobalt + Subtle (no override needed). For any other, write `apps/<slug>/src/styles/app.css` with the three-block token contract from §2.

### 8.5 Write the brief

`apps/<slug>/APP_BRIEF.md` per §9.

### 8.6 Install + typecheck

```bash
pnpm install
pnpm --filter <slug> typecheck   # fix every error
```

Run §6 against brief and implementation. Fix every blocking item.

### 8.7 Don't deploy siblings

Only deploy the new app. Scope any CI to `apps/<slug>/**`.

---

## 9. APP_BRIEF template

```markdown
# <App Name>

## Niche

<one-line audience + main job>

## Pain post

<URL>
<One-paragraph extract: the exact problem, in their words>

## Loop & monetization

- Retention loop: <repeat use / notification / SEO / embed / saved workflow>
- Monetization moment: <which user action unlocks the upgrade>
- Archetype: <tool-first / wizard / classic / alert / dashboard / widget / directory>
- Style + Radius: <e.g. Azure + Sharp> - <one-line rationale>

## V1 features

- <Feature 1>
- <Feature N>

## Out of scope

<Will do X and NOT do Y>

## Risks

- <Risk> - <Mitigation>

## Distribution

- <Channel> - <how automated>

## Success signal at 12 months

<the one number - e.g. "≥ 50 paying users", "≥ 1k monthly organic clicks">

## Deletion criteria (all four must hold)

- ≥ 12 months since launch (≥ 24 for directory / widget / alert)
- Zero paying users for 90 days
- Zero organic impressions for 90 days
- Hosting cost > $0 in observable value
```

---

## 10. Per-app CLAUDE.md

```markdown
# <App Name>

Built on `@offbeatport/microsaas-core`. All factory rules: [`../../FACTORY.md`](../../FACTORY.md).

- Archetype: <tool-first / ...>
- Niche slot: `src/features/<file>`
- Style + Radius: <e.g. Azure + Sharp>

Per-app overrides:
<empty by default>
```
