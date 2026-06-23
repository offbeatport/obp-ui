/**
 * All AI prompts in one place.
 * Edit here to tune AI behaviour across the whole app.
 */

import type { Signal } from "../db/schema.js";

// ── Source quality note ───────────────────────────────────────────────────────
// Injected into the cluster prompt so the model understands signal provenance.

export const SOURCE_QUALITY_NOTE = `
SOURCE QUALITY TIERS (use when scoring willingness_to_pay):
- TIER 1 - Strongest WTP evidence (someone already spending money or time):
  • jobs: company paying a human salary to do X manually = they'd pay for software
  • g2 / trustpilot / capterra / reviews: paying customer explaining why they cancelled or switched
  • github: highly-reacted feature request on a paid tool = proven demand gap
- TIER 2 - Moderate evidence (articulated pain from qualified buyers):
  • reddit: complaint in a professional subreddit (r/sysadmin, r/devops, r/datascience) with upvotes
  • stackoverflow: developer asking how to do X manually because no library exists
  • hn: Ask HN post or comment from a practitioner
  • ih: indie hacker community - solopreneurs with real products and budgets
- TIER 3 - Weak evidence (unvalidated complaint):
  • twitter / bluesky / mastodon: passing rant, may not reflect real buying intent
  • substack / devto / ph / lobsters: polished writing or showcase, rarely raw pain

When a cluster contains Tier 1 signals, the willingness_to_pay floor is 6. When it's all Tier 3, cap WTP at 4 regardless of how strong the language sounds.
`;

// ── Channel configs - initial generation when project is created ──────────────

export function channelConfigsPrompt(
  projectName: string,
  direction: string,
  channelTypes: string[],
  directionType: "platform" | "space" | "hunch" = "hunch"
): string {
  const platformBlock = `
PLATFORM GAP MINING - "${projectName}" is a known platform. Find where it fails its users.

Generate keywords across these angles:
1. REMOVED/BROKEN FEATURES: "[platform] [feature] removed", "[platform] [feature] broken", "[platform] [feature] 2024"
2. PRICING PAIN: "[platform] too expensive", "[platform] premium not worth it", "cancelled [platform]", "[platform] pricing"
3. MISSING CAPABILITY: "[platform] can't [action]", "wish [platform] had [feature]", "[platform] missing [feature]"
4. ALTERNATIVES: "[platform] alternative", "replacing [platform]", "migrating from [platform]", "better than [platform]"
5. ECOSYSTEM TOOLS: tools built around [platform] that users love/hate
6. DEVELOPER/API PAIN: "[platform] API [limit/cost/broken]", "[platform] developer [complaint]"
7. POWER USER WORKAROUNDS: "[platform] workaround", "[platform] hack", "automate [platform]"

Example for "X.com": "twitter analytics removed", "x.com too expensive", "tweetdeck replacement", "twitter api cost", "twitter shadowban", "twitter algorithm broken", "x premium not worth it", "twitter alternative 2024"`;

  const spaceBlock = `
PROBLEM SPACE DISCOVERY - "${projectName}" is a market space. Find pain across all angles.

STEP 1 - Identify the 3-5 main tools/competitors in this space.
STEP 2 - For each, generate: "[tool] expensive", "[tool] alternative", "paying for [tool]", "migrating from [tool]", "[tool] workaround", "[tool] missing [feature]"
STEP 3 - Add manual workflow signals: "manually [action] in spreadsheet", "no good tool for [problem]", "hacked together [task]", "zapier workflow for [task]"
STEP 4 - Add scale threshold signals: "outgrew [tool]", "[process] doesn't scale", "too many [items] to track manually"
STEP 5 - Add explicit demand signals: "is there a tool that [action]", "looking for software to [action]", "how do you [task] at scale"`;

  const hunchBlock = `
HUNCH VALIDATION - "${direction}". Validate if this pain is real and who's paying.

STEP 1 - Identify the 3-5 main tools/competitors in this space (if any exist).
STEP 2 - For each competitor: "[tool] expensive", "[tool] alternative", "[tool] workaround", "migrating from [tool]"
STEP 3 - Trigger event vocabulary - what do people search when this problem hits them?
STEP 4 - Manual workflow signals: "spreadsheet for [task]", "manually [action]", "script to automate [task]"
STEP 5 - Explicit demand: "is there a tool that [action related to hunch]", "looking for [solution]"
STEP 6 - WTP signals: "[category] tool worth paying for", "paying for [solution]", "$X/month [tool]"`;

  const caseBlock = directionType === "platform" ? platformBlock
    : directionType === "space" ? spaceBlock
      : hunchBlock;

  return `You are a market research assistant generating search keywords to find real buyer pain signals.

Direction: "${direction}"
${caseBlock}

Channels to generate for: ${channelTypes.join(", ")}

Return ONLY valid JSON - no explanation, no markdown:
{
  "reddit": { "keywords": ["keyword 1", "keyword 2", "..."] },
  "hn": { "keywords": ["keyword 1", "keyword 2"] },
  "g2": { "keywords": ["keyword 1", "keyword 2"] }
}

Rules:
- keywords only - no subreddits (those are discovered separately from real Reddit data)
- 10-14 keywords for reddit, 8-12 for all other channels
- Keywords must be 2-4 words max - short phrases, never full sentences
- "airtable expensive" not "why is airtable so expensive" - search finds both
- Mix: tool-anchored ("airtable expensive"), workaround ("airtable spreadsheet"), trigger ("channel demonetized"), scale ("outgrew notion")
- Only include channels from the list above`;
}

// ── Domain-first discovery - decompose domain, find all spaces it could own ───

export function channelConfigsDomainPrompt(domain: string, channelTypes: string[]): string {
  const stem = domain.replace(/\.[^.]+$/, ""); // "invoiceflow" from "invoiceflow.io"

  return `You are a market research assistant doing domain-first SaaS opportunity discovery.

Domain: ${domain}
Stem: "${stem}"

STEP 1 - Decompose "${stem}" into its semantic parts:
- What action(s) does it imply? (track, manage, sync, invoice, ship, report…)
- What object(s)? (invoices, data, leads, content, users…)
- What outcome? (flow = workflow/process, fast = speed, ly = tool suffix…)

STEP 2 - List exactly 5 candidate product spaces this domain could own.
For each space score domain fit 1-5: "would a buyer searching for this immediately understand ${domain}?"

STEP 3 - For each space generate 6 search keywords (2-4 words, concrete pain phrases).

STEP 4 - Merge all keywords into channel configs, putting highest domain-fit spaces first.

Channels: ${channelTypes.join(", ")}

Return ONLY valid JSON:
{
  "spaces": [
    { "name": "Freelance invoice management", "buyer": "freelancers", "domainFit": 5, "keywords": ["freshbooks expensive", "invoice tracking freelance", "wave alternative", "send invoice free", "invoice automation tool", "invoice late payment"] },
    { "name": "Agency client billing", "buyer": "agencies", "domainFit": 4, "keywords": ["agency billing software", "client invoice tool", "stripe invoicing alternative", "retainer billing tool", "agency payment tracker", "invoice approval workflow"] }
  ],
  "reddit": { "keywords": ["top 14 keywords merged from all spaces, best pain signals first"] },
  "hn": { "keywords": ["top 10 for technical/indie audience"] },
  "g2": { "keywords": ["top 10 for review site searches"] }
}

Rules:
- keywords 2-4 words max - "invoice automation" not "how do I automate my invoices"
- no subreddits (discovered separately)
- prioritize keywords from spaces with domain fit ≥ 4
- only include channels from the list above`;
}

// ── Channel suggestions - when user clicks "Suggest" on an existing channel ───

export function channelSuggestionsPrompt(
  projectName: string,
  hunch: string,
  channelType: string,
  existingKeywords: string[],
  existingSubreddits: string[]
): string {
  const alreadyHave = [
    existingKeywords.length > 0 && `Already using keywords: ${existingKeywords.join(", ")}`,
    existingSubreddits.length > 0 && `Already using subreddits: ${existingSubreddits.join(", ")}`,
  ].filter(Boolean).join("\n");

  return `You are a market research assistant generating search keywords to find real buyer pain.

Product idea: "${projectName}"
Context: "${hunch || "No context provided."}"
Channel: ${channelType}
${alreadyHave}

First identify the 3-5 main existing tools/competitors in this space.

Generate ${channelType === "reddit" ? "12 new keywords" : "12 new keywords"} - keywords only, no subreddits. Do NOT repeat any already-used items.

The best keywords combine a specific tool name with a pain signal:
  "[tool] expensive", "[tool] alternative", "[tool] row limit", "paying for [tool]",
  "[tool] workaround", "migrating from [tool]", "[tool] billing", "[tool] cancelled",
  "[tool] too slow", "[tool] missing [feature]", "[tool] vs [competitor]"

Return ONLY valid JSON:
{
  "keywords": ["phrase 1", "phrase 2"]
}

Rules:
- Keywords only - no subreddits (discovered separately from real Reddit data)
- 2-4 words max - "airtable expensive" not "why is airtable so expensive"
- at least 60% must include a specific tool/competitor name
- all items must be new, not in the existing lists`;
}

// ── Channel edit prompt - shown in the UI modal, user can modify before sending

export function channelEditPrompt(
  projectName: string,
  projectHypothesis: string | null | undefined,
  channelLabel: string,
  channelType: string,
  keywords: string[],
  subreddits: string[]
): string {
  const isReddit = channelType === "reddit";
  const kwList = keywords.length > 0 ? keywords.join(", ") : "none yet";
  const srList = subreddits.length > 0 ? subreddits.join(", ") : "none yet";

  let prompt = `Generate ${isReddit ? "10 new search keywords and 3–5 new subreddits" : "10 new search keywords"} for ${channelLabel} to discover pain, complaints, and unmet needs related to the following product idea.

Product: "${projectName}"
Context: "${projectHypothesis ?? "No context provided."}"`;

  if (keywords.length > 0) {
    prompt += `\n\nAlready using keywords: ${kwList}`;
  }
  if (isReddit && subreddits.length > 0) {
    prompt += `\nAlready using subreddits: ${srList}`;
  }

  prompt += `\n\nFirst identify the main existing tools/competitors in this space.

Requirements:
- At least 60% of keywords must be "[tool name] + pain signal" combos:
  e.g. "[tool] expensive", "[tool] alternative", "paying for [tool]", "migrating from [tool]", "[tool] workaround", "[tool] billing", "[tool] cancelled"
- The rest: concrete problem-space phrases ("manual [task] spreadsheet", "no good tool for [X]")
- NO generic phrases like "workflow automation" or "productivity pain"
- Do not repeat any existing items`;

  if (isReddit) {
    prompt += `\n- Subreddits: niche professional communities where the actual buyer posts (NOT r/entrepreneur or r/SaaS)`;
  }

  return prompt;
}

// ── Generate from custom prompt - wraps a user-edited prompt with JSON format ─

export function generateFromPromptWrapper(userPrompt: string): string {
  return `${userPrompt}

Return ONLY valid JSON in this exact format - no extra text:
{
  "keywords": ["phrase 1", "phrase 2"],
  "subreddits": ["SubredditName"]
}
If subreddits are not applicable, return an empty array for that field.`;
}

// ── Signal clustering ─────────────────────────────────────────────────────────

export function clusterPrompt(
  signals: Signal[],
  options?: { passBlocklist?: string[]; clusterSectors?: string; sourceQualityNote?: string }
): string {
  return `
You are a niche product opportunity analyst for SOLO ENTREPRENEURS who need real income - not VC-backed companies.

THE MISSION: Find painful, specific, profitable problems that one person can ship in a week and charge $49–$299/mo for. The buyer is a professional or solopreneur with a real budget who is already paying for a broken solution or doing something manually.

IDEAL OPPORTUNITY PROFILE:
- Buyer is a specific professional (e.g. "solo newsletter writer", "freelance data engineer", "Shopify store owner doing <$1M/yr")
- Pain costs them real time or money TODAY - not someday
- V1 can be shipped by one person in under 5 days
- $20k–$250k MRR reachable without a sales team (self-serve, SEO, or one community post)
- Niche is small enough to dominate, large enough to pay rent

${options?.sourceQualityNote ?? SOURCE_QUALITY_NOTE}

SIGNALS:
${signals.map((s, i) => `[${i}] source=${s.source}${s.toolName ? ` tool=${s.toolName}` : ""}${s.url ? ` url=${s.url}` : ""}
"${s.rawText.slice(0, 350)}"`).join("\n\n")}

STEP 1 - Classify each signal:
- PAIN: someone expressing a specific problem, frustration, or unmet need
- TRACTION: someone sharing revenue ($X MRR), paying customers, or that a specific product is working for them - proves a market exists and people pay
- WORKAROUND: someone describing a manual process, spreadsheet hack, or DIY solution they built themselves - proves no good tool exists
- SOLUTION: someone launching/announcing something they built (without revenue data) - weak market signal
- DISCUSSION: general conversation, strategy talk, no specific pain or proof - DISCARD

STEP 2 - Two opportunity types:

TYPE A - UNSERVED PAIN (primary):
- Requires 2+ PAIN or WORKAROUND signals on the same specific problem
- SOLUTION signals without revenue are disqualifying if they dominate
- These are gaps where the market exists but no good tool serves it

TYPE B - VALIDATED MARKET (clone opportunity):
- Requires 2+ TRACTION signals showing people pay for something specific
- These are proven markets where you build a cheaper, more niche, or better version
- Title format: "[Cheaper/Better/Niche version] of [what they're paying for]"
- Score pricing_ceiling high if market is clearly paying at $100+/mo

Rules for both:
- Each signal belongs to at most one cluster
- Cross-source validation boosts credibility
- DISCUSSION signals alone never form a cluster

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIFICITY IS THE ONLY THING THAT MATTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The single biggest failure mode is over-generalizing. You must resist it hard.

BAD (too broad - discard these):
✗ "Automated Content Repurposing Tool"     ← who? which platform? which format?
✗ "Freelancer Finance Dashboard"           ← which freelancers? which finance problem exactly?
✗ "Better Newsletter Analytics"            ← what metric? what workflow breaks without it?
✗ "SaaS Billing Transparency Tool"         ← for whom? at what plan size? which billing model?
✗ "AI Writing Assistant for Marketers"     ← replaceable by ChatGPT, too broad

GOOD (niche + specific - these are opportunities):
✓ "Substack → LinkedIn Thread Auto-Formatter for Sub-5k Newsletter Writers"
✓ "Stripe Atlas Invoice Reconciler for Solo Consultants Billing EU Clients"
✓ "Beehiiv Referral + Sponsorship Combined Payout Tracker"
✓ "Reddit Post Scheduler with Subreddit Rule Checker for Indie Hackers"
✓ "Figma-to-Webflow Token Sync for Solo Designers Without a Dev"

TITLE RULES (enforce strictly):
1. Must name the EXACT tool, platform, or workflow - not a category
2. Must name the EXACT persona or context - not "businesses" or "teams" or "users"
3. Must imply WHY the existing solution fails - the constraint is part of the title
4. Max 10 words. No "Automated", "AI-Powered", "Smart", "Better", "Unified" as first word.
5. If you can't name a specific tool or persona: the cluster is too broad - SKIP IT.

PAIN SUMMARY RULES:
- Name the exact role (e.g., "solo newsletter writer with under 10k subscribers", not "content creators")
- Name the exact current workaround (e.g., "manually copy-pasting into a spreadsheet every Monday")
- Name the exact moment of failure (e.g., "when Stripe and PayPal are both in use")

HARD FAILS (score 1 if any apply):
- ChatGPT can replicate it in one prompt for free
- Title could apply to any business or any developer (too broad)
- Opportunity requires marketplace/network effects
- Users are students or budget-constrained (under $1k/mo revenue)
- On users' critical path (downtime = disaster)
- Requires compliance or regulated activity
- Majority of supporting signals are launch posts
- All signals are Tier 3 sources only
- Well-funded incumbents already serve this exact niche
${options?.passBlocklist?.length ? `
EXCLUDED TOPICS (already reviewed and rejected - HARD FAIL):
${options.passBlocklist.join(", ")}
` : ""}
Score 1-10 per criterion. Most should be 4-6. Be strict - only exceptional ideas score 8+.
IMPORTANT: willingness_to_pay is weighted 2× in the final score - it is the most important criterion.

Criteria:
- buyer_quality: Score 8+ only if buyer is a named professional role with real budget (e.g. "freelance data engineer", "Substack writer earning $500+/mo"). Score 3 or less if buyer is "businesses", "teams", "developers in general", or students. Solopreneurs and small professionals are IDEAL buyers - score them high.
- pain_urgency: Costs real money or hours TODAY, not hypothetically. Score 7+ if they describe a recurring weekly pain or have already tried to fix it.
- willingness_to_pay (WEIGHT 2×): DIRECT money evidence only.
  Score 7+ if: job postings for manual work (T1), cancellation signals citing a gap (T1), paid workaround described
  Score 1-3 if: only social media venting, no dollar amounts, no tool costs mentioned
  SOCIAL PROOF: [SCORE: N] prefix → 500+ = boost WTP +1, <10 = anecdote only
- timing_signal: Is this problem getting WORSE or more urgent? Score 8+ if a recent platform change, new regulation, AI displacement, or macro trend is actively creating new pain. Score 5 if stable ongoing need. Score 2 if problem is declining or already well-served and shrinking.
- build_simplicity: Solo engineer ships useful V1 in 5 days. Score 8+ if it's a single-workflow tool with no complex backend. Score 3 or less if it requires marketplace bootstrapping, regulated APIs, or >2 major integrations at launch.
- distribution_ready: ONE community, ONE post reaches the exact buyer. Score 8+ if there is a named subreddit, Slack, or Discord where this exact buyer already congregates and discusses this exact pain.
- pricing_ceiling: What is the realistic monthly price a buyer would pay? Score calibrated to: 1-2 = <$10/mo (consumer, hard), 3-4 = $10–49/mo (prosumer), 5-6 = $50–199/mo (small business), 7-8 = $200–499/mo (SMB solid), 9-10 = $500+/mo (enterprise-adjacent). Base on what comparable tools charge or what the buyer's budget signals imply.

## Legal Safety
- Score 9-10: Pure SaaS productivity tool - no regulated domain, no user health/finance/legal advice, no data brokerage
- Score 7-8: Minor compliance considerations (GDPR, basic data handling) but no specialist legal exposure
- Score 4-6: Touches a regulated domain (fintech, healthcare, employment) but as tooling/automation, not as a licensed provider
- Score 1-3: Requires operating as a licensed entity (money transmission, medical advice, legal advice) or handles highly sensitive personal data at scale
- Default to 8 if signals don't indicate any regulated domain

## Contrarian flag
Set contrarian: true if the opportunity looks boring, niche, or unsexy on the surface BUT has strong WTP evidence (score 7+). The signal: conventional wisdom would dismiss this idea, but real buyers are already paying for it.

## Pricing model
Detect the best-fit pricing model from the signals:
- outcome-based: customer pays per measurable result (per lead, per saved hour, per document processed, per successful transaction). Best when the value is directly quantifiable and ROI is immediate. Strongest retention - they keep paying as long as outcomes arrive.
- usage-based: customer pays per unit consumed (per API call, per user, per GB, per run). Good when usage varies and scales with customer size.
- per-seat: fixed price per user/month. Works when adoption across a team is the value.
- freemium: free tier that converts. Works when viral/self-serve acquisition matters more than ARPU.
- one-time: single payment. Works for tools that solve a finite, one-shot problem.

Set pricing_model to the best fit. If outcome-based, set outcome_metric to the SPECIFIC measurable unit (e.g. "per successfully sent invoice", "per qualified lead generated", "per hour of manual work saved").

Return up to 5 wtp_signals per cluster (specific excerpts justifying WTP score):
Types: workaround | budget_spend | job_posting | already_paying | repeated_attempts | competitor_complaint

Sectors: ${options?.clusterSectors ?? "investment | human-proof-of-work | async-work | freelancer-finance | career-pivot | future-of-work | fintech | solopreneur | trading | high-revenue-potential | data | ai | legal | creator-economy"}

Respond ONLY with valid JSON:
{
  "opportunities": [
    {
      "title": "Specific Tool/Workflow for Exact Persona",
      "pain_summary": "Exact role + exact workaround failing + exact moment of pain",
      "sector": "one sector",
      "community": "specific community name (e.g. r/newsletters, not 'social media')",
      "community_url": "url or null",
      "scores": {
        "buyer_quality": 0, "pain_urgency": 0, "willingness_to_pay": 0, "timing_signal": 0,
        "build_simplicity": 0, "distribution_ready": 0, "pricing_ceiling": 0,
        "legal_safety": 8
      },
      "contrarian": false,
      "pricing_model": "per-seat",
      "outcome_metric": null,
      "score_reasoning": {
        "buyer_quality": "1 sentence: which signals show who the buyer is and why that score",
        "pain_urgency": "1 sentence: what evidence of urgency or lack thereof",
        "willingness_to_pay": "1 sentence: direct money signals or why absent",
        "timing_signal": "1 sentence: what trend or event is making this worse, or why stable/declining",
        "build_simplicity": "1 sentence: what makes it easy or hard to ship V1",
        "distribution_ready": "1 sentence: specific community or why hard to reach",
        "pricing_ceiling": "1 sentence: what comparable tools charge or what signals imply about budget",
        "legal_safety": "1 sentence: any regulatory or IP risk or why safe"
      },
      "reasoning": "2-3 sentences naming exact signals, exact tools, exact workflow - no generalities",
      "signal_indices": [0, 3, 7],
      "wtp_signals": [
        {"index": 3, "type": "workaround", "excerpt": "we spend 3 hours every Monday exporting to Excel..."},
        {"index": 7, "type": "already_paying", "excerpt": "paying $149/mo for Cledara just to catch overages..."}
      ]
    }
  ]
}
`;
}

// ── Opportunity brief ─────────────────────────────────────────────────────────

export function briefPrompt(title: string, painSummary: string, signals: Signal[]): string {
  return `You are writing a market opportunity brief for a solo entrepreneur targeting $10k–$250k/month in MRR. They have no co-founder, no sales team, and no VC money. Every opportunity must be:
- Shippable by one person in under 5 days
- Priced at $49–$299/mo (self-serve, no enterprise sales)
- Targeting a niche small enough to reach with a single community post, but large enough to sustain $100k+ MRR
- Solving a painful, specific, recurring problem - not a "nice to have"

Your job is to be SPECIFIC and NICHE - not broad.

Opportunity: ${title}
Pain: ${painSummary}

Source signals:
${signals.slice(0, 30).map((s, i) => `[${i + 1}] "${s.rawText.slice(0, 300)}"`).join("\n\n")}

Write a brief in markdown. Every section must name specific tools, communities, roles, dollar amounts, and workflows. No generalities.

SPECIFICITY RULES (apply to every section):
- Name the EXACT tool the buyer currently uses and why it fails (e.g. "Notion for tracking, exported to CSV manually every Friday")
- Name the EXACT community (e.g. "r/Substack with 89k members", not "newsletter communities")
- Name the EXACT buyer (e.g. "solo newsletter writer, 2k–15k subscribers, earning $500–3k/mo from Substack", not "content creators")
- Name EXACT dollar amounts for MRR estimates and comparable tools

## Hidden Need
[The specific underlying job-to-be-done that no current tool addresses. Name the exact workflow step that breaks.]

## Who Buys This
[Exact role + revenue/company size + current tool they use + the exact moment that tool fails them.]

## Competitors
| Tool | Why people pay for it | Critical weakness |
|------|----------------------|-------------------|
[3-4 real named competitors with specific pricing and honest weaknesses from the signals. No made-up tools.]

## Competitor Gaps
- List each specific competitor product mentioned in the signals and what they concretely lack for this use case (e.g. "HubSpot - no per-seat pricing below $800/mo, blocks solo consultants")
- Identify the most common switching trigger: what event causes users to start searching for alternatives (e.g. "price increase announcement", "missing API endpoint after a feature removal")
- Suggest precise positioning relative to the named competitor: what one sentence would you put on the landing page hero that names the competitor and the gap (e.g. "The Airtable alternative that doesn't charge per-seat for view-only collaborators")

## Self-Growth Mechanism
[How this spreads without ads. Must be concrete: e.g. "shared invoice PDF carries branding", "team member imported = second seat", not vague "word of mouth".]

## V1 Features
[4-6 specific features as a table. Each must solve a named problem from the signals. No "dashboard" or "analytics" without specifics.]

| Feature | Problem | Example | Pri | Eff | Feasibility | Mechanism | Constraint |
|---------|---------|---------|-----|-----|-------------|-----------|------------|

Column rules — feasibility is the most important part, be a skeptical senior engineer:
- Feature: 3-5 word name
- Problem: the exact named pain/signal it solves
- Example: one concrete instance, ideally input → output (e.g. "asks 'best running shoe store?' → report: you appear in 3/20 answers")
- Pri: Must / Should / Could (MoSCoW)
- Eff: S / M / L build size
- Feasibility: Proven / Plausible / Speculative / Impossible. DEFAULT to Speculative. A feature earns Proven/Plausible ONLY by naming a known, existing technique. Pick the worst-case honestly.
- Mechanism: ONE sentence stating the real technical approach using existing technology. If you cannot write an honest concrete mechanism, the feature is Impossible — say so and leave the mechanism describing why no mechanism exists.
- Constraint: the single thing most likely to make it fail or impossible (physics, model limits, non-determinism, data access, latency, cost, ToS).

Impossible and Speculative rows are VALUABLE — they stop wasted builds. Do NOT soften ratings or invent mechanisms to be helpful. A feature whose only "mechanism" is wishful (e.g. "make the LLM cheaper by switching batch to realtime" — that removes the very discount that makes batch cheap) must be marked Impossible.

## Risks
[3-4 risks with mitigations. Name real incumbents, real API limitations, real adoption barriers.]

## Distribution
**Primary:** [Exact community name + URL + member count + why this exact post reaches the buyer]
How to enter: [Exact post title and first 2 sentences of the post. Not a template - write the actual post opener.]

**Secondary:** [Second named channel]

## Expected MRR
- Low: $X,XXX/mo ([N] users × $[price]/mo) - [why this is the floor]
- High: $XX,XXX/mo ([N] users × $[price]/mo) - [what unlocks this]
- Avg: $X,XXX/mo

Comparable tools: [1-2 real SaaS tools with actual pricing that validates this price point]

## Demand Proof
3-5 specific quotes or behaviors from the signals that prove real paying demand:
- [Type: workaround/budget_spend/job_posting/already_paying/repeated_attempts] "[verbatim quote]" - what this proves about budget or urgency

## Why It Passes the Filter
- Not replaceable by ChatGPT because: [specific reason tied to the workflow, not generic]
- Self-growth: [concrete mechanism]
- Buyers have budget because: [evidence from signals]
- Ready distribution because: [exact community + entry point]
- Why this niche and not the broad market: [what makes this specific segment better to target first]
`;
}

// ── Extract insights from a brief ─────────────────────────────────────────────

export function insightsPrompt(title: string, briefMd: string): string {
  return `Extract structured data from this opportunity brief. Return ONLY valid JSON, no other text.

Title: ${title}

Brief:
${briefMd.slice(0, 3000)}

Return exactly:
{
  "hidden_need": "1 sentence",
  "mrr_low": 3000,
  "mrr_high": 15000,
  "mrr_avg": 8000,
  "self_growth": "1 sentence",
  "v1_features": ["feature 1", "feature 2", "feature 3"],
  "feature_table": [
    {
      "feature": "3-5 word name",
      "problem": "exact named pain it solves",
      "example": "concrete instance, ideally input → output",
      "priority": "Must | Should | Could",
      "effort": "S | M | L",
      "feasibility": "Proven | Plausible | Speculative | Impossible",
      "mechanism": "ONE sentence: the real technical approach using existing tech. If none is honest, the feature is Impossible.",
      "constraint": "the single thing most likely to make it fail or impossible",
      "done_when": "one-line acceptance test"
    }
  ],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "distribution_primary": "Community + how to enter in 1 sentence",
  "price_anchor": "What buyers currently spend on workarounds or explicit $ signals from the signals. E.g. 'paying $200/mo for Zapier glue' or 'would pay $50-100/mo'. If no direct evidence, null.",
  "buyer_persona": "Specific buyer in 1 sentence: role + company size + current workaround. E.g. 'Data engineers at 20-200 person startups who maintain hand-rolled Airflow DAGs.'",
  "competitors": ["ToolName ($price/mo) - critical weakness in 6 words", "..."],
  "niche_signal": "One sentence: how tightly scoped is this niche (e.g. 'Targets solo Substack writers under 10k subscribers - small enough to dominate with one post, large enough for $10k MRR'). Null if the opportunity is too broad or the niche is unclear."
}

feature_table is the most important field. Be a skeptical senior engineer: default feasibility to Speculative, only upgrade to Proven/Plausible when you can name a real existing technique in the mechanism, and mark Impossible (with a mechanism sentence explaining why none exists) for any feature that is wishful or self-contradictory. v1_features must be the same features as feature_table, names only, in the same order.`;
}

// ── Pre-score signals - cheap pass to filter noise before expensive clustering ─

export function prescorePrompt(signals: Signal[]): string {
  return `Score each signal 1-5: does it prove a specific person would pay to solve a specific problem?

5 = Very strong: job posting for manual work, paying customer cancellation with named tool, workaround with explicit cost/time, feature request on a paid tool with 10+ reactions. Signal names a specific tool, workflow, or dollar amount.
4 = Strong: professional describing a real recurring workflow gap with enough specifics to identify the buyer. Names the tool failing them or the exact step that breaks.
3 = Moderate: legitimate pain but vague - could apply to anyone, no named tool or workflow, unclear if buyer has budget
2 = Weak: general complaint ("X is hard"), casual mention, no buying signal, too short, or the problem is clearly a commodity
1 = Drop: solution launch ("I built X", "Show HN:", "just released", "announcing"), off-topic, student/hobbyist context, or the pain is so generic ChatGPT solves it free

Penalize signals that are TOO BROAD - a signal about "content marketing is hard" is less valuable than one about "Substack's CSV export breaks when you have multiple publications". Specificity = signal quality.

Signals:
${signals.map((s, i) => `[${i}] source=${s.source}: "${s.rawText.slice(0, 250)}"`).join("\n\n")}

Return ONLY valid JSON: {"scores": [4, 2, 5, 1, 3]} - one integer per signal in input order.`;
}
