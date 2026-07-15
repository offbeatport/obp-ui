# C Slop Slop - Layout Prototypes Brief (shared, read this first)

You are building **one** standalone HTML layout prototype for **C Slop Slop**. 10 prototypes
total, each a different STYLE + STRUCTURAL LAYOUT, but all share the product model, the mock
data below, and the hard requirements. Your specific assignment is in your task prompt.

## What the product is (from SPEC.md - do not invent beyond this)
> **From thought to bag.** Turn a thought into a real, deployed software product - built, tested,
> and shipped by agents one validated slice at a time. You don't write code; you direct agents.

- **The primitive is a `company`** = a committed product bet (one company = one product).
- The loop: **thought → opportunities (cheap, scored) → promote to company → bag → bag → bag**
  (each "bag" = a validated, deployed *slice*). Agents pull the top-priority slice across all
  companies, ship it (live + proven), re-prioritize. Continuous priority loop, not a pipeline.
- **A slice (`feature`) = a vertical, independently-shippable user capability** ("user can do X")
  with an executable `doneWhen` check. Slice status: `todo | building | awaiting_approval | shipped | blocked`.
- **Build law:** every iteration ships ONE user-facing capability - live + proven, never "code written."
  The product is always live. Slice #1 = a walking skeleton.
- **The headline feature = the approval gate (L0):** the human approves a slice, shown the
  **diff + the live preview URL + the validation result**. Approve, or **reject-with-feedback**.
- **Agents/runs/orchestration are INVISIBLE ENGINE.** There is **NO agent screen, NO run-kind
  picker, NO agent management controls.** You never "manage agents." You see *what companies are
  doing* (per-slice status + a preview URL) so it's trustable, not opaque. Frame the live feed as
  **build/company activity**, never as a panel of knobs over agents.
- **Chat is the spine.** Global command/chat bar at the portfolio level; per-company chat when zoomed.
- 3 surfaces: **Companies board**, **Company** (chat + live artifacts), **Opportunities inbox**.

## HARD REQUIREMENTS (every prototype must satisfy all)
1. **Single self-contained `.html` file** - inline `<style>` + inline `<script>`, mocked data only,
   no build step, opens directly in a browser by double-click. A single Google Fonts `<link>` is allowed.
2. **Two states, both reachable by interaction:**
   - **Overview / dashboard** - all companies + portfolio metrics + opportunities + next moves.
   - **Company zoom-in** - click a company to drill into it; a clear way back to overview (Esc/back/click-out).
3. **The zoomed company is `LeadSift`** and it MUST surface the **approval gate**: the diff, the live
   preview URL, the green `doneWhen` result, and **Approve / Reject-with-feedback** buttons that give a
   small visible confirmation on click (e.g. flash "Approved ✓"). This is the most important screen.
4. **Chat present** - global command bar in overview; company chat in zoom (chat is the spine).
5. **Opportunities** represented somewhere (candidate cards with score → a "Promote" affordance).
6. **Live activity strip** - collapsible. **Collapsed = only the single latest current line** (or one
   compact line per actively-building company). **Expanded = the full real-time stream**, grouped by
   company, running items animated (pulsing dot). No pause/config controls - read-only visibility.
7. **Infinite-grow right + bottom** - the canvas/layout must visibly extend horizontally (right) and
   vertically (bottom): horizontal scroll/pan/columns/tabs/splits + vertical scroll. Express it the way
   your assigned layout naturally does (see your prompt). It should *feel* like it can keep growing.
8. **No agent-management UI** (see invisible-engine note). Keep autonomy legible via status + preview URL.
9. A small fixed **corner badge** naming the prototype, e.g. `01 · Drill Columns`, so it's identifiable.
10. Polished + DISTINCTIVE per your assigned visual style - avoid generic AI-dashboard aesthetics.
    Desktop-first. Clean code, ~500–1200 lines is fine.

## Status → color convention (keep consistent across all 10)
- company: `active` = green · `paused` = amber · `archived` = gray
- slice: `todo` = slate · `building` = blue (pulsing) · `awaiting_approval` = violet/amber (NEEDS YOU)
  · `shipped` = green · `blocked` = red

## MOCK DATA - copy this `DATA` object verbatim into your script and render from it
```js
const DATA = {
  portfolio: { mrr: 695, users: 56, activeCompanies: 5, slicesShipped: 22, needsYou: 1 },
  companies: [
    { id:'leadsift', name:'LeadSift', thesis:'Scrape + score inbound leads from any webform.',
      status:'active', domain:'leadsift.app', previewUrl:'http://localhost:4019',
      mrr:180, users:12, needsYou:true,
      slices:[
        {n:1, title:'A visitor can submit the lead webform',       status:'shipped',           check:'green'},
        {n:2, title:'Leads are stored and shown in a table',       status:'shipped',           check:'green'},
        {n:3, title:'Each lead gets an auto score 0–100',          status:'shipped',           check:'green'},
        {n:4, title:'User can filter leads by score',              status:'shipped',           check:'green'},
        {n:5, title:'User gets a daily email digest of top leads', status:'awaiting_approval', check:'green', priority:91},
        {n:6, title:'User can export leads to CSV',                status:'todo',              priority:74},
        {n:7, title:'Slack ping on a hot lead',                    status:'todo',              priority:60, dependsOn:[5]},
        {n:8, title:'Inbound webhook integration',                 status:'blocked',           note:'no progress - same failure ×3'},
      ],
      approval:{
        slice:5, title:'User gets a daily email digest of top leads',
        previewUrl:'http://localhost:4019/digest/preview',
        doneWhen:'GET /digest/preview → 200 and body contains "Top leads"',
        checkResult:'passed', attempt:2,
        diff:[
          "+ export function DailyDigest({ leads }: { leads: Lead[] }) {",
          "+   const top = leads.filter(l => l.score >= 70).slice(0, 10)",
          "+   return <DigestEmail subject=\"Your top leads today\" leads={top} />",
          "+ }",
          "  // schedule: cron 08:00, per-user timezone",
          "+ scheduleDailyDigest(userId, \"08:00\")",
        ].join("\n"),
      },
    },
    { id:'quietinbox', name:'QuietInbox', thesis:'Email triage that auto-drafts replies you can approve.',
      status:'active', domain:'quietinbox.io', previewUrl:'http://localhost:4021', mrr:420, users:38, needsYou:false,
      currentSlice:{n:9, title:'Snooze a thread until tomorrow', status:'building', step:'deploying to local container'}, slicesShipped:8 },
    { id:'translatorbill', name:'TranslatorBill', thesis:'Auto-translate + reformat invoices for cross-border freelancers.',
      status:'active', domain:null, previewUrl:'http://localhost:4023', mrr:0, users:0, needsYou:false,
      currentSlice:{n:6, title:'Digest scheduler UI', status:'building', step:'writing DigestScheduler.tsx'}, slicesShipped:4 },
    { id:'datadrop', name:'DataDrop', thesis:'CSV intake → clean → instant dashboard.',
      status:'active', domain:'datadrop.sh', previewUrl:'http://localhost:4025', mrr:95, users:6, needsYou:false,
      currentSlice:{n:6, title:'Saved chart views', status:'todo', step:'queued'}, slicesShipped:5 },
    { id:'redditpainbot', name:'RedditPainBot', thesis:'Mine subreddits for pain posts → ranked micro-SaaS ideas.',
      status:'paused', domain:null, previewUrl:null, mrr:0, users:0, needsYou:false,
      currentSlice:{n:8, title:'Dedupe near-identical pains', status:'blocked', step:'stopped - no progress'}, slicesShipped:2 },
  ],
  opportunities: [
    { id:'o1', thought:'freelancers hate reconciling stripe payouts by hand', title:'PayoutReconciler', thesis:'Match Stripe payouts to invoices automatically.', score:82, status:'candidate' },
    { id:'o2', thought:'podcasters spend hours adding chapter markers',       title:'ChapterForge',     thesis:'Auto-generate chapter markers from a transcript.', score:71, status:'candidate' },
    { id:'o3', thought:'designers waste time renaming layers',                title:'LayerTidy',        thesis:'One-click layer naming for Figma.',                score:54, status:'candidate' },
    { id:'o4', thought:'shopify stores need quick refund triage',             title:'RefundTriage',     thesis:'Prioritize refund requests by risk.',              score:38, status:'killed' },
  ],
  activity: [
    { co:'TranslatorBill', kind:'building',     text:'building slice 6 - writing DigestScheduler.tsx',        t:'now', running:true },
    { co:'QuietInbox',     kind:'deploy',       text:'deployed to localhost:4021 - running doneWhen probe',   t:'12s', running:true },
    { co:'LeadSift',       kind:'await',        text:'slice 5 awaiting your approval',                        t:'2m' },
    { co:'LeadSift',       kind:'check',        text:'doneWhen passed - GET /digest/preview → 200',           t:'2m' },
    { co:'DataDrop',       kind:'reprioritize', text:'re-prioritized backlog - slice 6 now top',              t:'5m' },
    { co:'RedditPainBot',  kind:'blocked',      text:'slice 8 blocked - no progress (same failure ×3)',       t:'18m' },
  ],
  nextMoves: [
    'Approve LeadSift slice 5 (daily digest) - it’s live and the check is green',
    'Unblock RedditPainBot slice 8, or pause the company',
    'Promote “PayoutReconciler” (score 82) to a company',
  ],
  chat: [
    { role:'assistant', text:'LeadSift just shipped a daily digest. It’s live at localhost:4019 and the check passed - want to approve it?' },
    { role:'user',      text:'show me the diff first' },
    { role:'assistant', text:'Here’s the slice - one new component + a scheduler. Preview URL + green check are attached above.' },
  ],
};
```
