# BurningDemand - Project Initialization Roadmap

Last updated: 2026-04-30 (Phase 0 complete)

---

## Phase 0 - End-to-end working loop

Goal: press "Initialize Project", follow the wizard, have a live deployed product at a real domain.

- [x] **#1** Global Settings - Namecheap + Cloudflare + Coolify API keys
    - Add Namecheap (API user + key + whitelisted IP hint), Cloudflare (API token + account ID), Coolify (API key + server URL) to Settings → new "Integrations" tab. Same pattern as Git settings.

- [x] **#2** Wizard Step 1 - Select opportunity
    - Replace V0InitFlow with a multi-step wizard. Step 1: pick from analyzed opportunities. Selected opportunity becomes context for design, copy, and features throughout wizard. Store opportunityId.

- [x] **#3** Wizard Step 2 - Domain (Namecheap)
    - Two paths: (a) enter a domain you already own, or (b) check a name via Namecheap domains.check API. Show availability + price. Buy via Namecheap API. Store domain on project. (.com only)

- [x] **#4** Wizard Step 3 - Cloudflare DNS setup
    - Call Cloudflare API to add domain as a zone (or find existing). Get assigned NS servers. Call Namecheap API to set those NS servers on the domain. Confirm. Store zone ID on project.

- [x] **#5** Wizard Step 4 - VPS IP → A record
    - Input field for VPS IP (where Coolify is running). Call Cloudflare API to create A record: domain → VPS IP. Store vpsIp on project. Note SSL strategy: Cloudflare Full (strict) recommended.

- [x] **#6** Wizard Step 5 - Design context from opportunity
    - Generate opportunity markdown as a design brief (already built in NewVersionModal). Show "Copy design brief" + "Open claude.ai/design". Paste design output back → stored as project designDirection. Step is skippable.

- [x] **#7** Wizard Step 6 - Create GitHub repo from template
    - Use existing init-project.ts logic. Create bd-{slug} repo, copy base template, pnpm install, git push. Show terminal output inline. On success store repoUrl. Skip/reuse if repo already exists.

- [x] **#8** Wizard Step 7 - Select initial features
    - Pre-populate from opportunity v1_features (same "Import from analysis" logic in BuildSubTab). User can add/remove/reorder before build starts. Store as feature records linked to this opportunity.

- [x] **#9** Wizard Step 8 - Build with Claude Code
    - Trigger existing build-opportunity pipeline (claude --dangerously-skip-permissions). Show terminal inline. When dev server starts, show "Open localhost" button. Capture session ID for "Open in Warp" button.

- [x] **#10** Wizard Step 9 - Deploy to Coolify (webhook, Phase 0)
    - Phase 0: user manually creates Coolify app and pastes webhook URL here. Trigger deploy, show status. On success mark v0 as shipped. Left sidebar updates to show "v0 · live".

- [x] **#11** Add Dockerfile + docker-compose.yml to base template
    - Dockerfile: Node 20 slim, pnpm build, pnpm start. docker-compose.yml: app service + named SQLite volume for persistence. Required for Coolify deployment.

---

## Phase 1 - Automate the manual steps

Goal: wizard provisions all services automatically - no copy-pasting API keys or DSNs.

- [ ] **#12** Global Settings - Sentry + PostHog + Polar.sh API keys
    - Add Sentry (auth token + org slug), PostHog (personal API key), Polar.sh (API key + org slug) to Settings → Integrations. Used in Phase 1 to auto-provision per-project resources.

- [ ] **#13** Wizard: auto-create Coolify app via API
    - Use Coolify API (key + server URL from global settings) to create a new application resource. Set repo URL, branch, domain, port. Configure CPU/memory limits. Return webhook URL automatically.

- [ ] **#14** Wizard: auto-create Sentry project + inject DSN
    - Use Sentry API to create project under org. Get DSN. Write SENTRY_DSN to Coolify env vars via Coolify API. No manual copy-paste.

- [ ] **#15** Wizard: auto-create PostHog project + inject key
    - Use PostHog API to create project. Get project API key. Inject POSTHOG_KEY into Coolify env vars. Store project key on project record.

- [ ] **#16** Wizard: auto-create Polar.sh product + inject token
    - Use Polar.sh API to create product under org. Inject POLAR_ACCESS_TOKEN into Coolify env vars. Store product ID + checkout URL on project.

- [ ] **#17** Wizard: inject all env vars into Coolify before deploy
    - After all services provisioned, batch-set env vars via Coolify API: SENTRY_DSN, POSTHOG_KEY, POLAR_ACCESS_TOKEN, BETTER_AUTH_SECRET (generated), BETTER_AUTH_URL (= domain), DATABASE_URL. Deploy only after env vars are set.

- [ ] **#18** Wizard: OAuth callback registration step
    - After domain is live, show checklist: GitHub OAuth app callback URL (domain/api/auth/callback/github), Google OAuth if needed. Manual steps - show exact URLs to copy + links to right settings pages.

- [ ] **#19** Wizard: social accounts step
    - Config step: Twitter/X handle, LinkedIn URL, Product Hunt username. Store on project. Used for distribution posts later. No API integration - just form fields.

- [ ] **#20** Build: session ID capture + Open in Warp button
    - Capture Claude Code session ID from build stdout. Store in build registry. "Open in Warp" button uses warp:// deep link with --resume {sessionId}. "Open Local" button uses devUrl. "Deploy" already exists in DeployBar.

---

## Phase 2 - Polish + edge cases

Goal: nothing is write-once, everything is recoverable, the happy path is bulletproof.

- [ ] **#21** All wizard settings editable in Project Config
    - Every field set during the wizard (domain, VPS IP, Coolify app ID, Sentry DSN, PostHog key, Polar product, social handles, env vars) viewable and editable in project Configure modal or Project Settings page.

- [ ] **#22** Cloudflare SSL strategy configuration
    - During DNS step, let user choose: Cloudflare proxy Full/Strict (easiest - Cloudflare handles cert) vs direct (Let's Encrypt via Coolify). Set Cloudflare SSL mode via API. Document tradeoffs in UI.

- [ ] **#23** Domain availability - AI-generated name suggestions
    - Use Claude (cheap model) to generate 20+ .com suggestions from opportunity title, buyer persona, pain. Batch-check via Namecheap API. Show as cards with price. Refresh for 20 more. "Buy" goes through Namecheap purchase flow.

- [ ] **#24** Post-deploy smoke test
    - After Coolify deploy, auto-check: domain reachable (HTTP 200), Sentry receiving events (test error), PostHog receiving pageviews. Show green/red per service. Surfaces misconfiguration before user ships.

---

## Already built (reference)

- [x] Base template at `templates/base-template/` (TanStack Start + Sentry + PostHog + Polar + better-auth)
- [x] Git global settings (org + token + test connection)
- [x] GitHub repo creation (`scripts/init-project.ts`, `bd-` prefix)
- [x] Build pipeline (`scripts/build-opportunity.ts`, SSE streaming)
- [x] Coolify webhook deploy (existing DeployBar)
- [x] Version history left sidebar (VersionTree)
- [x] Deployed features right sidebar (DeployedFeaturesSidebar)
- [x] New Version modal with opportunity picker
- [x] Design brief copy (opportunity → claude.ai/design format)
- [x] Project rename from opportunity
- [x] Tech stacks (global presets, per-project selection)
- [x] Purge project data
- [x] Cancel version
- [x] Reset v0 init
