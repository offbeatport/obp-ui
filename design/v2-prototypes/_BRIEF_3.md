# C Slop Slop - Prototype Brief, Batch 3 (the unified GTM + comms model)

Read `_BRIEF.md` FIRST (product model, status colors, the base `DATA` object with companies /
features / opportunities / activity / chat). This addendum adds the new model + extra mock data
your prototype must use. Your specific assignment is in your task prompt.

## The model these 5 prototypes exist to express
The app is an **evidence engine** at **three altitudes**: `feature ⊂ company ⊂ portfolio`. The
keystone insight is that **everything you act on is the same unit - "a proposed real-world action
awaiting your approval."** Shipping a feature, sending a tweet, firing a cold-email batch, replying
to a support ticket, authorizing ad spend are all the *same shape*: **preview + evidence + Approve /
Reject-with-feedback.** So GTM is not a separate app - it rides the same gate.

- **Two-way comms layer** (this is what GTM/Twitter/cold-reach/support forces into the design):
  - **inward** = you ⇄ your co-founder agent (you direct the build).
  - **outward** = the company ⇄ the world: **outbound** (Twitter / build-in-public, cold email/DM) +
    **inbound** (support inbox). The agent **drafts**, you **approve**, it goes out; replies come
    back as **evidence**.
- **Autopilot gate rule (must be visible in the UI):** reversible, non-spend *features* can
  auto-ship on autopilot; **anything that talks to a real human or spends real money is ALWAYS
  gated to you** - tweets, cold emails, support replies, ad spend. Mark gated items clearly.
- **Support is an evidence stream, not a cost center** - tickets seed features + signal keep/kill.
- **Evidence ladder** (cheapest-validation-first): `thought → score → live → doneWhen → adoption →
  test-payment → MRR`. Items climb only when the rung below pays off.

## HARD REQUIREMENTS (every batch-3 prototype)
1. Self-contained single `.html` (inline `<style>` + `<script>`, vanilla JS only, one Google Fonts
   `<link>` allowed, mock data only, opens by double-click). NO external JS libraries.
2. **Three altitudes reachable:** a **portfolio** view, **zoom into a company**, and **zoom into a
   feature** (or a clear feature-level detail). A way back at each level (Esc/back/breadcrumb).
3. **The universal "Needs you" queue** - render the `QUEUE` below with **≥4 different action kinds**
   (`ship_feature`, `tweet`, `cold_batch`, `support_reply`, `authorize_spend`). Every item shows its
   **evidence** line + **Approve / Reject-with-feedback** with visible confirmation on click.
   **Gated items** (`gated:true` → real-human / real-money) must be visually marked "you must approve";
   a `ship_feature` that is reversible may show "autopilot can ship this".
4. **The LeadSift feature approval** (`q1`) must expand to the full gate: diff + live preview URL
   (`http://localhost:4019/digest/preview`) + green `doneWhen` + Approve/Reject.
5. **The two-way comms layer present:** inward co-founder chat AND outbound (Twitter/build-in-public
   + cold reach) AND inbound support - drafts are approvable; show that replies/results are evidence.
6. **Collapsible live-activity** strip (collapsed = latest line, expand = stream; now also carries
   comms events like "posted", "reply drafted", "batch sent"). No agent-management knobs.
7. **Evidence framing visible** - show items' rung / evidence somewhere (the ladder, or per-item).
8. Infinite-grow: **right** = altitude/depth, **bottom** = streams/time (endless scroll).
9. Modern, simple, polished, restrained palette + one accent. A fixed corner badge with your number+name.
10. Wire every interaction in vanilla JS (zoom, back, approve/reject feedback, activity toggle,
    switching comms streams). No agent-management UI; agents are invisible engine.

## EXTRA MOCK DATA - copy verbatim, render alongside base `DATA`
```js
const QUEUE = [ // universal "Needs you" - heterogeneous proposed real-world actions
  { id:'q1', kind:'ship_feature', company:'LeadSift', title:'Ship: daily digest of top leads',
    evidence:'doneWhen green · localhost:4019/digest/preview', gated:false, autopilot:true, rung:'doneWhen',
    diff:DATA.companies[0].approval.diff, previewUrl:'http://localhost:4019/digest/preview' },
  { id:'q2', kind:'tweet', company:'LeadSift', title:'Build-in-public post', gated:true, channel:'content', rung:'adoption',
    evidence:'last post: 2.2k impressions → 14 likes → 3 signups',
    draft:'Shipped today: LeadSift now scores every inbound lead and emails you the top 10 at 8am ☕ No more digging your inbox for the ones worth calling. → leadsift.app' },
  { id:'q3', kind:'cold_batch', company:'TranslatorBill', title:'Cold email: 25 cross-border freelancers (batch 2 of 3)', gated:true, channel:'outbound', rung:'adoption',
    evidence:'batch 1: 25 sent → 36% open → 8% reply',
    draft:'Subject: the invoice-translation thing\n\nHi {{name}} - you invoice clients in 3 currencies. TranslatorBill auto-translates + reformats each invoice to local norms in ~5s. Worth a look? - V' },
  { id:'q4', kind:'support_reply', company:'QuietInbox', title:'Reply: “snooze a whole label, not just a thread?”', gated:true, rung:'adoption',
    evidence:'3rd request this week → candidate feature',
    draft:'Great question - today snooze is per-thread, but “snooze a label” is now on our list (you’re the 3rd to ask). I’ll ping you the moment it ships.' },
  { id:'q5', kind:'authorize_spend', company:'DataDrop', title:'Authorize $50 Google Ads test - “csv to dashboard”', gated:true, channel:'ads', amountUsd:50, rung:'test-payment',
    evidence:'organic SEO page converts 3.1% → worth a paid test' },
];

const OUTBOUND = {
  twitter:[ // build-in-public stream
    { status:'posted', t:'2d', text:'Day 41: LeadSift crossed $180 MRR. One feature did most of it - lead scoring. Doubling down.', stats:'2.2k impressions · 14 likes · 3 signups' },
    { status:'draft',  t:'now', text:'Shipped today: LeadSift now emails you your top 10 leads at 8am. → leadsift.app', stats:'awaiting your approval' },
  ],
  cold:[ // sequences (per company)
    { company:'TranslatorBill', segment:'cross-border freelancers · 3+ currencies', size:25, step:'batch 2 of 3', stats:'batch 1 → 36% open · 8% reply', status:'draft awaiting approval' },
  ],
};

const SUPPORT = [ // inbound = evidence stream
  { id:'t1', company:'QuietInbox', user:'maria@acme.co', subject:'Snooze a whole label?',      status:'needs_reply', signal:'feature request ×3',        body:'Love the per-thread snooze. Any way to snooze an entire label at once?' },
  { id:'t2', company:'LeadSift',   user:'devon@dgsales.io', subject:'Digest came at 6am not 8am', status:'needs_reply', signal:'bug → timezone',           body:'My digest arrived at 6am - I’m in PST, expected 8am local.' },
  { id:'t3', company:'DataDrop',   user:'sam@sheetly.app', subject:'Can I save a chart view?',  status:'answered',    signal:'matches backlog feature 6', body:'Is there a way to save a dashboard layout so I don’t rebuild it each time?' },
];

const LADDER = [ // evidence rungs, cheapest first → most committed
  { rung:'thought',      cost:'free',        items:[{label:'“auto-chapter podcasts”', kind:'opportunity'}] },
  { rung:'score',        cost:'cents',       items:[{label:'PayoutReconciler · 82', kind:'opportunity'},{label:'ChapterForge · 71', kind:'opportunity'}] },
  { rung:'live',         cost:'agent-hours', items:[{label:'RedditPainBot · skeleton', kind:'company'}] },
  { rung:'doneWhen',     cost:'one run',     items:[{label:'LeadSift · digest feature', kind:'feature'}] },
  { rung:'adoption',     cost:'traffic',     items:[{label:'QuietInbox · snooze', kind:'feature'},{label:'TranslatorBill · cold batch', kind:'campaign'}] },
  { rung:'test-payment', cost:'a feature',   items:[{label:'DataDrop · ads test', kind:'campaign'},{label:'LeadSift · Stripe test', kind:'feature'}] },
  { rung:'MRR',          cost:'real money',  items:[{label:'QuietInbox · $420', kind:'company'},{label:'LeadSift · $180', kind:'company'}] },
];

const ACTION_KIND = { // labels + glyphs for the universal queue
  ship_feature:    { label:'Ship feature',     glyph:'⚡' },
  tweet:           { label:'Post (build-in-public)', glyph:'𝕏' },
  cold_batch:      { label:'Cold outreach',     glyph:'✉' },
  support_reply:   { label:'Support reply',     glyph:'❝' },
  authorize_spend: { label:'Authorize spend',   glyph:'$' },
};
```
