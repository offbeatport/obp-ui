import { spawnSync } from "child_process";
import OpenAI from "openai";
import { trackCost } from "./cost-tracker.js";
import type { Signal, DiscoveredCommunityProfile, CFFData } from "../db/schema.js";
import type { ScoreCriteria, OpportunityInsights } from "./types.js";
import { SCORE_CRITERIA } from "./types.js";
import {
  channelConfigsPrompt,
  channelConfigsDomainPrompt,
  channelSuggestionsPrompt,
  generateFromPromptWrapper,
  clusterPrompt,
  briefPrompt,
  insightsPrompt,
  prescorePrompt,
} from "./prompts.js";

// WTP counts double - everything else weight 1
const SCORE_WEIGHTS: Record<string, number> = { willingness_to_pay: 2 };

function computeWeightedScore(scores: Record<string, number>): number {
  let weightedSum = 0, totalWeight = 0;
  for (const [key, val] of Object.entries(scores)) {
    if (typeof val !== "number") continue;
    const w = SCORE_WEIGHTS[key] ?? 1;
    weightedSum += val * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

// ---------------------------------------------------------------------------
// Provider selection
// Set AI_PROVIDER=claude-cli in .env to use your Claude Code subscription.
// Set AI_PROVIDER=openrouter (default) to use OpenRouter/Anthropic API.
// ---------------------------------------------------------------------------

type Provider = "openrouter" | "claude-cli";

function getProvider(): Provider {
  return (process.env.AI_PROVIDER as Provider) || "openrouter";
}

// ---------------------------------------------------------------------------
// OpenRouter transport
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5";
const MODEL = () => process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
const PRESCORE_MODEL = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-3.1-flash-lite-preview";
const KEYWORD_MODEL = process.env.OPENROUTER_KEYWORD_MODEL || PRESCORE_MODEL;

function extractJson(text: string): string {
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Find first { or [ to last } or ]
  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
const PRESCORE_BATCH = 50;
const EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL || "openai/text-embedding-3-small";
const EMBED_BATCH = 100;

export async function embedText(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENROUTER_API_KEY || texts.length === 0) return [];
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "BurningDemand",
      },
    });

    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      batches.push(texts.slice(i, i + EMBED_BATCH));
    }

    const batchResults = await Promise.all(
      batches.map((batch) =>
        client.embeddings.create({ model: EMBED_MODEL, input: batch })
      )
    );

    const results: number[][] = new Array(texts.length);
    batchResults.forEach((resp, bIdx) => {
      const offset = bIdx * EMBED_BATCH;
      resp.data.forEach((item) => {
        results[offset + item.index] = item.embedding;
      });
    });

    return results;
  } catch (err) {
    console.error("embedText error:", err);
    return [];
  }
}

// Load the OpenRouter key from the founder profile into env if not already set (it
// is stored via Settings but was previously never loaded).
let _keyLoaded = false;
async function ensureOpenRouterKey(): Promise<void> {
  if (_keyLoaded || process.env.OPENROUTER_API_KEY) { _keyLoaded = true; return; }
  try {
    const { db, founderProfile } = await import("../db/index.js");
    const [p] = await db.select().from(founderProfile).limit(1);
    if (p?.openRouterKey) process.env.OPENROUTER_API_KEY = p.openRouterKey;
  } catch { /* ignore */ }
  _keyLoaded = true;
}

export async function callOpenRouter(prompt: string, json: boolean, model?: string): Promise<string> {
  await ensureOpenRouterKey();
  const m = (model || MODEL()) as string;
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "BurningDemand",
    },
  });
  const response = await client.chat.completions.create({
    model: m,
    messages: [{ role: "user", content: prompt }],
    temperature: json ? 0.2 : 0.4,
    max_tokens: 16384,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
  const u = response.usage;
  if (u) {
    console.log(`[LLM] model=${m} in=${u.prompt_tokens} out=${u.completion_tokens}`);
    trackCost(m, u.prompt_tokens, u.completion_tokens, "generation", response.id, prompt, response.choices[0].message.content ?? undefined);
  }
  return response.choices[0].message.content || "";
}

// ---------------------------------------------------------------------------
// Claude CLI transport - uses your claude-code subscription via `claude -p`
// ---------------------------------------------------------------------------

function callClaudeCLI(prompt: string, opts?: { model?: string; bin?: string }): string {
  const bin = opts?.bin || process.env.CLAUDE_BIN || "claude";
  const args = ["-p"];
  if (opts?.model) args.push("--model", opts.model);
  args.push(prompt);
  const result = spawnSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${bin} CLI exited ${result.status}: ${result.stderr?.slice(0, 300)}`);
  }
  return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// Per-task AI proxy: route each task category to CLI or OpenRouter per config
// ---------------------------------------------------------------------------

export type AiTaskKey = "build" | "opportunity" | "scoring" | "summaries" | "channels" | "distribution" | "discovery";

const _taskCfgCache = new Map<string, { tool: string; cliBin: string | null; model: string | null }>();
export function clearAiConfigCache() { _taskCfgCache.clear(); }

async function loadTaskConfig(taskKey: string) {
  if (_taskCfgCache.has(taskKey)) return _taskCfgCache.get(taskKey)!;
  let cfg = { tool: "cli", cliBin: null as string | null, model: null as string | null };
  try {
    const { db, aiTaskConfig } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(aiTaskConfig).where(eq(aiTaskConfig.taskKey, taskKey));
    if (row) cfg = { tool: row.tool, cliBin: row.cliBin, model: row.model };
  } catch { /* defaults */ }
  _taskCfgCache.set(taskKey, cfg);
  return cfg;
}

/** Route a prompt to the configured tool/model for a task category. */
export async function dispatchAI(taskKey: AiTaskKey, prompt: string, json = false): Promise<string> {
  const cfg = await loadTaskConfig(taskKey);
  if (cfg.tool === "cli") {
    return callClaudeCLI(prompt, { model: cfg.model ?? undefined, bin: cfg.cliBin ?? undefined });
  }
  return callOpenRouter(prompt, json, cfg.model ?? undefined);
}

// ---------------------------------------------------------------------------
// Unified dispatcher (legacy binary env switch — kept for back-compat)
// ---------------------------------------------------------------------------

async function callAI(prompt: string, json: boolean): Promise<string> {
  if (getProvider() === "claude-cli") return callClaudeCLI(prompt);
  return callOpenRouter(prompt, json);
}

// ---------------------------------------------------------------------------
// Channel config generation (cheap model)
// ---------------------------------------------------------------------------

export async function generateChannelConfigs(
  projectName: string,
  hunch: string,
  channelTypes: string[],
  directionType: "platform" | "space" | "hunch" | "domain" = "hunch"
): Promise<Record<string, { keywords?: string[]; subreddits?: string[] }>> {
  if (!process.env.OPENROUTER_API_KEY || channelTypes.length === 0) return {};

  const prompt = directionType === "domain"
    ? channelConfigsDomainPrompt(hunch, channelTypes) // hunch holds the raw domain e.g. "invoiceflow.io"
    : channelConfigsPrompt(projectName, hunch, channelTypes, directionType);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: KEYWORD_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    if (resp.usage) trackCost(KEYWORD_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "keyword-gen", resp.id, prompt, resp.choices[0].message.content ?? undefined);
    const raw = resp.choices[0].message.content || "{}";
    console.log("[keyword gen] raw response:", raw.slice(0, 500));
    return JSON.parse(extractJson(raw));
  } catch (err) {
    console.error("generateChannelConfigs error:", err);
    return {};
  }
}

export async function generateChannelSuggestions(
  projectName: string,
  hunch: string,
  channelType: string,
  existingKeywords: string[],
  existingSubreddits: string[]
): Promise<{ keywords: string[]; subreddits: string[] }> {
  if (!process.env.OPENROUTER_API_KEY) return { keywords: [], subreddits: [] };

  const prompt = channelSuggestionsPrompt(projectName, hunch, channelType, existingKeywords, existingSubreddits);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "channel-suggestions", resp.id, prompt, resp.choices[0].message.content ?? undefined);
    const parsed = JSON.parse(extractJson(resp.choices[0].message.content || "{}"));
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      subreddits: Array.isArray(parsed.subreddits) ? parsed.subreddits : [],
    };
  } catch (err) {
    console.error("generateChannelSuggestions error:", err);
    return { keywords: [], subreddits: [] };
  }
}

export async function generateFromPrompt(
  userPrompt: string
): Promise<{ keywords: string[]; subreddits: string[] }> {
  if (!process.env.OPENROUTER_API_KEY) return { keywords: [], subreddits: [] };

  const fullPrompt = generateFromPromptWrapper(userPrompt);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.6,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "channel-suggestions", resp.id, fullPrompt, resp.choices[0].message.content ?? undefined);
    const parsed = JSON.parse(extractJson(resp.choices[0].message.content || "{}"));
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      subreddits: Array.isArray(parsed.subreddits) ? parsed.subreddits : [],
    };
  } catch (err) {
    console.error("generateFromPrompt error:", err);
    return { keywords: [], subreddits: [] };
  }
}

export async function generateFullOpportunityFromDescription(description: string): Promise<{
  title: string;
  painSummary: string;
  sector: string;
  community: string;
  scoresJson: Record<string, number>;
  insightsJson: Record<string, unknown>;
  scoreTotal: number;
  briefMd: string;
}> {
  const fallback = {
    title: description.slice(0, 80),
    painSummary: description.slice(0, 400),
    sector: "saas", community: "general",
    scoresJson: {}, insightsJson: {}, scoreTotal: 0, briefMd: "",
  };
  if (!process.env.OPENROUTER_API_KEY) return fallback;

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
  });

  const structuredPrompt = `You are a niche product opportunity analyst for solo entrepreneurs.

The founder has described this opportunity in detail. Use it as your primary source. Augment with your own knowledge where gaps exist.

DESCRIPTION:
${description}

Return ONLY valid JSON with exactly these fields. Score every criterion 1–10. Be strict - most should be 4–7. Only genuinely exceptional evidence scores 8+.

{
  "title": "Specific product name for exact persona - max 12 words. Must name the tool/workflow AND the persona. No AI-powered/Smart/Better/Unified as first word.",
  "painSummary": "2–3 sentences: exact buyer role, what they currently do, the specific moment of failure.",
  "sector": "one of: saas | developer-tools | creator-economy | freelancer-finance | async-work | solopreneur | fintech | ai | data | legal | other",
  "community": "single most specific community where this buyer congregates",
  "scores": {
    "pain_urgency": 0,
    "willingness_to_pay": 0,
    "buyer_quality": 0,
    "viral_potential": 0,
    "build_simplicity": 0,
    "distribution_ready": 0,
    
    "revenue_potential": 0,
    "competitor_gap": 0,
    "legal_safety": 8
  },
  "score_reasoning": {
    "pain_urgency": "1 sentence: what evidence of urgency or lack thereof",
    "willingness_to_pay": "1 sentence: direct money signals or why absent",
    "buyer_quality": "1 sentence: who the buyer is and why that score",
    "viral_potential": "1 sentence: growth mechanism or why weak",
    "build_simplicity": "1 sentence: what makes V1 easy or hard to ship",
    "distribution_ready": "1 sentence: specific reachable community or why hard",
    
    "revenue_potential": "1 sentence: market size evidence or constraint",
    "competitor_gap": "1 sentence: named competitors and their specific weakness",
    "legal_safety": "1 sentence: any regulatory/IP risk or why safe"
  },
  "insights": {
    "mrr_low": 0,
    "mrr_high": 0,
    "mrr_avg": 0,
    "buyer_persona": "exact role, company size, current tool, specific trigger",
    "price_anchor": "what buyers currently pay for partial solutions",
    "distribution_primary": "exact community + URL + how to reach them",
    "niche_signal": "one sentence on why this niche is underserved right now",
    "hidden_need": "the underlying job-to-be-done no current tool addresses",
    "v1_features": ["feature 1 that solves named pain", "feature 2", "feature 3", "feature 4"],
    "feature_table": [
      {
        "feature": "3-5 word name",
        "problem": "exact named pain it solves",
        "example": "concrete instance, ideally input → output",
        "priority": "Must | Should | Could",
        "effort": "S | M | L",
        "feasibility": "Proven | Plausible | Speculative | Impossible",
        "mechanism": "ONE sentence: the real technical approach using existing tech. If none is honest, mark Impossible and explain why no mechanism exists.",
        "constraint": "the single thing most likely to make it fail or impossible",
        "done_when": "one-line acceptance test"
      }
    ],
    "self_growth": "concrete mechanism - how does using the product spread it",
    "risks": ["risk 1 with mitigation", "risk 2 with mitigation", "risk 3 with mitigation"],
    "competitors": ["Competitor - specific weakness"],
    "source_platforms": ["manual"],
    "wtp_evidence": []
  }
}`;

  const briefPromptText = `You are writing a market opportunity brief for a solo entrepreneur targeting $10k–$250k/month in MRR.

The founder has described this opportunity. Treat the description as authoritative. Augment with market research where useful.

OPPORTUNITY DESCRIPTION:
${description}

Write a full brief in markdown. Be specific: name exact tools, communities, dollar amounts, workflows, and competitors. No generalities.

## Hidden Need
[The specific underlying job-to-be-done. Name the exact workflow step that breaks.]

## Who Buys This
[Exact role + revenue/company size + current tool + the exact moment it fails them.]

## Competitors
| Tool | Why people pay for it | Critical weakness |
|------|----------------------|-------------------|
[3–4 real named competitors with specific pricing and honest weaknesses.]

## Competitor Gaps
[For each competitor: what specifically it lacks for this use case + the switching trigger + one positioning sentence that names the competitor and the gap.]

## Self-Growth Mechanism
[How this spreads without ads. Must be concrete - name the artifact, the action, the chain.]

## V1 Features
[4–6 specific features as a table. Each must solve a named problem. No vague "dashboard" or "analytics".]

| Feature | Problem | Example | Pri | Eff | Feasibility | Mechanism | Constraint |
|---------|---------|---------|-----|-----|-------------|-----------|------------|

Be a skeptical senior engineer. Feasibility is Proven/Plausible/Speculative/Impossible — default to Speculative, only upgrade when the Mechanism names a real existing technique. Mechanism is ONE sentence using existing tech; if you cannot write an honest one, mark the feature Impossible and say why. Constraint = the single thing most likely to make it fail. Impossible/Speculative rows are valuable — never soften ratings or invent mechanisms.

## Risks
[3–4 risks with specific mitigations. Name real incumbents, real API risks, real adoption barriers.]

## Distribution
**Primary:** [Exact community name + URL + member count + why this reaches the buyer]
How to enter: [Write the actual first 2 sentences of the post - not a template]

**Secondary:** [Second named channel]

## Expected MRR
- Low: $X,XXX/mo ([N] users × $[price]/mo) - [why this is the floor]
- High: $XX,XXX/mo ([N] users × $[price]/mo) - [what unlocks this]
- Avg: $X,XXX/mo`;

  try {
    const [structuredResp, briefResp] = await Promise.all([
      client.chat.completions.create({
        model: PRESCORE_MODEL,
        messages: [{ role: "user", content: structuredPrompt }],
        temperature: 0.4,
      }),
      client.chat.completions.create({
        model: MODEL(),
        messages: [{ role: "user", content: briefPromptText }],
        temperature: 0.5,
      }),
    ]);
    if (structuredResp.usage) trackCost(PRESCORE_MODEL, structuredResp.usage.prompt_tokens, structuredResp.usage.completion_tokens, "clustering", structuredResp.id, structuredPrompt, structuredResp.choices[0].message.content ?? undefined);
    if (briefResp.usage) trackCost(MODEL(), briefResp.usage.prompt_tokens, briefResp.usage.completion_tokens, "brief", briefResp.id, briefPromptText, briefResp.choices[0].message.content ?? undefined);

    const parsed = JSON.parse(extractJson(structuredResp.choices[0].message.content || "{}"));
    const scores: Record<string, number> = parsed.scores ?? {};
    const scoreTotal = computeWeightedScore(scores);

    return {
      title: typeof parsed.title === "string" ? parsed.title : fallback.title,
      painSummary: typeof parsed.painSummary === "string" ? parsed.painSummary : fallback.painSummary,
      sector: typeof parsed.sector === "string" ? parsed.sector : fallback.sector,
      community: typeof parsed.community === "string" ? parsed.community : fallback.community,
      scoresJson: scores,
      insightsJson: {
        ...(typeof parsed.insights === "object" && parsed.insights ? parsed.insights : {}),
        ...(typeof parsed.score_reasoning === "object" && parsed.score_reasoning ? { score_reasoning: parsed.score_reasoning } : {}),
        ...(typeof parsed.contrarian === "boolean" ? { contrarian: parsed.contrarian } : {}),
        ...(typeof parsed.pricing_model === "string" ? { pricing_model: parsed.pricing_model } : {}),
        ...(typeof parsed.outcome_metric === "string" && parsed.outcome_metric ? { outcome_metric: parsed.outcome_metric } : {}),
      },
      scoreTotal,
      briefMd: briefResp.choices[0].message.content?.trim() ?? "",
    };
  } catch (err) {
    console.error("generateFullOpportunityFromDescription error:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Refine existing opportunity
// ---------------------------------------------------------------------------

export async function refineOpportunityWithAI(
  existing: {
    title: string;
    painSummary: string;
    sector: string;
    community: string;
    communityUrl?: string | null;
    scoresJson: Record<string, number>;
    insightsJson: Record<string, unknown> | null;
    briefMd?: string | null;
  },
  changeRequest: string,
): Promise<{
  title: string;
  painSummary: string;
  sector: string;
  community: string;
  scoresJson: Record<string, number>;
  insightsJson: Record<string, unknown>;
  scoreTotal: number;
  briefMd: string;
}> {
  const fallback = {
    title: existing.title, painSummary: existing.painSummary,
    sector: existing.sector, community: existing.community,
    scoresJson: existing.scoresJson, insightsJson: existing.insightsJson ?? {},
    scoreTotal: 0, briefMd: existing.briefMd ?? "",
  };
  if (!process.env.OPENROUTER_API_KEY) return fallback;

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
  });

  const ins = existing.insightsJson ?? {} as Record<string, unknown>;

  const context = `CURRENT OPPORTUNITY:
Title: ${existing.title}
Pain: ${existing.painSummary}
Sector: ${existing.sector} | Community: ${existing.community}${existing.communityUrl ? ` (${existing.communityUrl})` : ""}

Current scores: ${JSON.stringify(existing.scoresJson)}
Buyer: ${(ins as any).buyer_persona ?? "unknown"}
Price anchor: ${(ins as any).price_anchor ?? "unknown"}
Hidden need: ${(ins as any).hidden_need ?? "unknown"}
Distribution: ${(ins as any).distribution_primary ?? "unknown"}
V1 features: ${JSON.stringify((ins as any).v1_features ?? [])}
Feature table: ${JSON.stringify((ins as any).feature_table ?? [])}
Competitors: ${JSON.stringify((ins as any).competitors ?? [])}

FOUNDER'S CHANGE REQUEST:
${changeRequest}

Update the opportunity to incorporate this change. Keep everything that shouldn't change identical.
Return ONLY valid JSON:

{
  "title": "...",
  "painSummary": "2–3 sentences: exact buyer, current workflow, failure moment.",
  "sector": "saas|developer-tools|creator-economy|freelancer-finance|async-work|solopreneur|fintech|ai|data|legal|other",
  "community": "most specific community",
  "scores": { "pain_urgency":0,"willingness_to_pay":0,"buyer_quality":0,"viral_potential":0,"build_simplicity":0,"distribution_ready":0,"revenue_potential":0,"competitor_gap":0,"legal_safety":0 },
  "score_reasoning": { "buyer_quality":"","pain_urgency":"","willingness_to_pay":"","timing_signal":"","build_simplicity":"","distribution_ready":"","pricing_ceiling":"","legal_safety":"" },
  "contrarian": false,
  "insights": {
    "mrr_low":0,"mrr_high":0,"mrr_avg":0,
    "buyer_persona":"","price_anchor":"","distribution_primary":"","niche_signal":"",
    "hidden_need":"","v1_features":[],"self_growth":"",
    "feature_table":[{"feature":"","problem":"","example":"","priority":"Must|Should|Could","effort":"S|M|L","feasibility":"Proven|Plausible|Speculative|Impossible","mechanism":"ONE sentence real approach; if none honest, mark Impossible","constraint":"single thing most likely to make it fail","done_when":""}],
    "risks":[],"competitors":[],"source_platforms":[],"wtp_evidence":[]
  }
}

Be a skeptical senior engineer on feature_table: default feasibility to Speculative, only upgrade when mechanism names a real existing technique, mark wishful/self-contradictory features Impossible. Keep v1_features as the feature_table names in the same order.`;

  const briefContext = `You are rewriting a market opportunity brief for a solo entrepreneur.

ORIGINAL BRIEF:
${existing.briefMd ?? "(none yet)"}

CHANGE REQUEST:
${changeRequest}

Rewrite the full brief incorporating the change. Keep sections that aren't affected unchanged.
Same structure: ## Hidden Need / ## Who Buys This / ## Competitors / ## Competitor Gaps / ## Self-Growth Mechanism / ## V1 Features / ## Risks / ## Distribution / ## Expected MRR
## V1 Features must be a markdown table with columns: Feature | Problem | Example | Pri | Eff | Feasibility | Mechanism | Constraint. Feasibility is Proven/Plausible/Speculative/Impossible — be a skeptical engineer, default to Speculative, mark wishful features Impossible with a mechanism sentence explaining why.`;

  try {
    const [structuredResp, briefResp] = await Promise.all([
      client.chat.completions.create({
        model: PRESCORE_MODEL,
        messages: [{ role: "user", content: context }],
        temperature: 0.4,
      }),
      client.chat.completions.create({
        model: MODEL(),
        messages: [{ role: "user", content: briefContext }],
        temperature: 0.5,
      }),
    ]);
    if (structuredResp.usage) trackCost(PRESCORE_MODEL, structuredResp.usage.prompt_tokens, structuredResp.usage.completion_tokens, "refine-clustering", structuredResp.id, context, structuredResp.choices[0].message.content ?? undefined);
    if (briefResp.usage) trackCost(MODEL(), briefResp.usage.prompt_tokens, briefResp.usage.completion_tokens, "refine-brief", briefResp.id, briefContext, briefResp.choices[0].message.content ?? undefined);

    const parsed = JSON.parse(extractJson(structuredResp.choices[0].message.content || "{}"));
    const scores: Record<string, number> = parsed.scores ?? existing.scoresJson;
    const scoreTotal = computeWeightedScore(scores);

    return {
      title: typeof parsed.title === "string" ? parsed.title : existing.title,
      painSummary: typeof parsed.painSummary === "string" ? parsed.painSummary : existing.painSummary,
      sector: typeof parsed.sector === "string" ? parsed.sector : existing.sector,
      community: typeof parsed.community === "string" ? parsed.community : existing.community,
      scoresJson: scores,
      insightsJson: {
        ...(typeof parsed.insights === "object" && parsed.insights ? parsed.insights : ins),
        ...(typeof parsed.score_reasoning === "object" && parsed.score_reasoning ? { score_reasoning: parsed.score_reasoning } : {}),
        ...(typeof parsed.contrarian === "boolean" ? { contrarian: parsed.contrarian } : {}),
        ...(typeof parsed.pricing_model === "string" ? { pricing_model: parsed.pricing_model } : {}),
        ...(typeof parsed.outcome_metric === "string" && parsed.outcome_metric ? { outcome_metric: parsed.outcome_metric } : {}),
      },
      scoreTotal,
      briefMd: briefResp.choices[0].message.content?.trim() ?? existing.briefMd ?? "",
    };
  } catch (err) {
    console.error("refineOpportunityWithAI error:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Summarise what changed after a refinement
// ---------------------------------------------------------------------------

export async function summariseRefinementChanges(
  changeRequest: string,
  diffs: Array<{ label: string; before: string; after: string }>,
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY || diffs.length === 0) {
    return `Updated ${diffs.length} field${diffs.length !== 1 ? "s" : ""} based on your request.`;
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
  });
  const diffText = diffs.map(d => `- **${d.label}**: "${d.before}" → "${d.after}"`).join("\n");
  const prompt = `A market opportunity was refined based on this request: "${changeRequest}"

These fields changed:
${diffText}

In 2–3 concise sentences, explain what was changed and why it matters for the opportunity. Be specific - name the fields and values.`;

  try {
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "brief", resp.id, prompt, resp.choices[0].message.content ?? undefined);
    return resp.choices[0].message.content?.trim() ?? "";
  } catch {
    return `Updated ${diffs.length} field${diffs.length !== 1 ? "s" : ""} based on your request.`;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WtpSignalRaw {
  index: number;
  type: "workaround" | "budget_spend" | "job_posting" | "already_paying" | "repeated_attempts" | "competitor_complaint";
  excerpt: string;
}

export interface ClusteredOpportunity {
  title: string;
  pain_summary: string;
  sector: string;
  community: string;
  community_url: string | null;
  scores: Record<ScoreCriteria, number>;
  score_reasoning?: Record<string, string>;
  reasoning: string;
  signal_indices: number[];
  wtp_signals: WtpSignalRaw[];
}


// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

function stripFences(s: string): string {
  return s.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
}

export async function clusterSignals(signals: Signal[], options?: { passBlocklist?: string[]; clusterSectors?: string; sourceQualityNote?: string }): Promise<ClusteredOpportunity[]> {
  try {
    const raw = JSON.parse(stripFences(await dispatchAI("scoring", clusterPrompt(signals, options), true)));
    if (!Array.isArray(raw.opportunities)) return [];
    // Per-criterion defaults when the LLM omits a field
    const SCORE_DEFAULTS: Record<ScoreCriteria, number> = {
      buyer_quality: 5,
      pain_urgency: 5,
      willingness_to_pay: 5,
      timing_signal: 5,
      build_simplicity: 5,
      distribution_ready: 5,
      pricing_ceiling: 5,
      legal_safety: 8,
    };

    return raw.opportunities
      .filter((o: ClusteredOpportunity) => o.title && o.scores && Array.isArray(o.signal_indices))
      .map((o: ClusteredOpportunity) => ({
        ...o,
        wtp_signals: o.wtp_signals ?? [],
        // Fill any missing score keys so downstream code never sees undefined
        scores: Object.fromEntries(
          SCORE_CRITERIA.map(c => [c.key, o.scores?.[c.key] ?? SCORE_DEFAULTS[c.key]])
        ) as Record<ScoreCriteria, number>,
      }));
  } catch (err) {
    console.error("clusterSignals error:", err);
    return [];
  }
}

export async function generateBrief(title: string, painSummary: string, signals: Signal[]): Promise<string> {
  return dispatchAI("opportunity", briefPrompt(title, painSummary, signals), false);
}

export async function extractInsights(title: string, briefMd: string): Promise<OpportunityInsights | null> {
  try {
    const raw = JSON.parse(stripFences(await dispatchAI("opportunity", insightsPrompt(title, briefMd), true)));
    if (!raw.hidden_need) return null;
    return raw as OpportunityInsights;
  } catch (err) {
    console.error("extractInsights error:", err);
    return null;
  }
}

export async function preScoreSignals(signals: Signal[]): Promise<{ kept: Signal[]; dropped: number }> {
  if (!process.env.OPENROUTER_API_KEY || signals.length === 0) {
    return { kept: signals, dropped: 0 };
  }

  const batches: Signal[][] = [];
  for (let i = 0; i < signals.length; i += PRESCORE_BATCH) {
    batches.push(signals.slice(i, i + PRESCORE_BATCH));
  }

  const allScores = new Array(signals.length).fill(3); // default: pass

  await Promise.all(
    batches.map(async (batch, bIdx) => {
      try {
        const client = new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
        });
        const resp = await client.chat.completions.create({
          model: PRESCORE_MODEL as string,
          messages: [{ role: "user", content: prescorePrompt(batch) }],
          temperature: 0,
          max_tokens: 512,
        });
        if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "prescore", resp.id, prescorePrompt(batch), resp.choices[0].message.content ?? undefined);
        const raw = JSON.parse(extractJson(resp.choices[0].message.content || "{}"));
        const scores: number[] = Array.isArray(raw.scores) ? raw.scores : [];
        const offset = bIdx * PRESCORE_BATCH;
        for (let i = 0; i < batch.length; i++) {
          if (typeof scores[i] === "number") allScores[offset + i] = scores[i];
        }
      } catch (err) {
        console.error(`[prescore] batch ${bIdx} error - keeping defaults:`, err);
      }
    })
  );

  const kept = signals.filter((_, i) => allScores[i] >= 2); // drop score 1 only: solution launches, off-topic, hobbyist
  return { kept, dropped: signals.length - kept.length };
}

// ---------------------------------------------------------------------------
// Discovery: extract keywords from founder prompt
// ---------------------------------------------------------------------------

export async function extractDiscoveryKeywords(prompt: string): Promise<string[]> {
  if (!process.env.OPENROUTER_API_KEY) return [];
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL as string,
      messages: [
        {
          role: "system",
          content: "You extract search keywords from a founder's profile description. Return ONLY a JSON array of 6-12 short keyword phrases (2-4 words each) suitable for searching Reddit communities. Keywords should describe problem domains, not technologies. No markdown, no explanation.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "discovery-keywords", resp.id, prompt, resp.choices[0].message.content ?? undefined);
    const raw = resp.choices[0].message.content || "[]";
    const parsed = JSON.parse(extractJson(raw));
    return Array.isArray(parsed) ? parsed as string[] : [];
  } catch (err) {
    console.error("extractDiscoveryKeywords error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Discovery: analyze community posts to produce a community profile
// ---------------------------------------------------------------------------

export async function analyzeDiscoveredCommunityPosts(params: {
  subreddit: string;
  posts: Array<{ title: string; selftext: string; score: number; num_comments: number; topComments: string[] }>;
  founderPrompt: string;
}): Promise<DiscoveredCommunityProfile> {
  const defaultProfile: DiscoveredCommunityProfile = {
    communityCharacter: "Community analysis unavailable.",
    whoPostsHere: "Unknown",
    opennessScore: 5,
    painDensityScore: 5,
    purchaseIntentScore: 5,
    topPainThemes: [],
    whatGetsTraction: "Unknown",
    whatFails: "Unknown",
    distributionPlaybook: "Unknown",
    avoidList: [],
    tractionPosts: [],
    buyerRatio: 0.3,
    generatedAt: new Date().toISOString(),
  };

  if (!process.env.OPENROUTER_API_KEY) return defaultProfile;

  const systemPrompt = `You are an expert community analyst. Given Reddit posts from a subreddit, produce a JSON community profile. Return ONLY valid JSON matching this exact shape:
{
  "communityCharacter": "2-3 sentence description of who's here and what they talk about",
  "whoPostsHere": "concise buyer/builder/lurker breakdown",
  "opennessScore": 1-10,
  "painDensityScore": 1-10,
  "purchaseIntentScore": 1-10,
  "topPainThemes": [{"theme": "string", "frequency": 1-10}],
  "whatGetsTraction": "specific formats, tones, title patterns that work",
  "whatFails": "what gets ignored or downvoted",
  "distributionPlaybook": "concrete actionable posting strategy for this community",
  "avoidList": ["thing1", "thing2"],
  "tractionPosts": [{"title": "string", "score": number, "comments": number, "url": "string", "why": "why this worked"}],
  "buyerRatio": 0.0-1.0,
  "generatedAt": "ISO date string"
}
Traction posts: pick the top 5 by (score * sqrt(num_comments)) from the provided posts. buyerRatio: estimate what fraction of posters are genuine buyers (not builders/sellers). opennessScore: how welcoming to solution-oriented posts (1=hostile, 10=very open).`;

  const userMessage = `Subreddit: r/${params.subreddit}
Founder background: ${params.founderPrompt}

Posts (up to 60 days):
${JSON.stringify(params.posts.slice(0, 80), null, 2)}`;

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: MODEL() as string,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });
    if (resp.usage) trackCost(MODEL(), resp.usage.prompt_tokens, resp.usage.completion_tokens, "community-profile", resp.id, userMessage, resp.choices[0].message.content ?? undefined);
    const raw = resp.choices[0].message.content || "{}";
    const parsed = JSON.parse(extractJson(raw)) as DiscoveredCommunityProfile;
    return { ...defaultProfile, ...parsed, generatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("analyzeDiscoveredCommunityPosts error:", err);
    return defaultProfile;
  }
}

// ---------------------------------------------------------------------------
// Discovery: compute Community-Founder Fit (CFF) score
// ---------------------------------------------------------------------------

export async function computeCFF(params: {
  founderPrompt: string;
  extractedKeywords: string[];
  subreddit: string;
  profile: DiscoveredCommunityProfile;
}): Promise<CFFData> {
  const defaultCFF: CFFData = {
    score: 5,
    reason: "Analysis unavailable",
    dimensions: { relevance: 5, credibility: 5, buildability: 5, distributionFit: 5 },
  };

  if (!process.env.OPENROUTER_API_KEY) return defaultCFF;

  const userMessage = `Founder profile: ${params.founderPrompt}
Founder keywords: ${params.extractedKeywords.join(", ")}

Community: r/${params.subreddit}
Character: ${params.profile.communityCharacter}
Who posts: ${params.profile.whoPostsHere}
Top pain themes: ${params.profile.topPainThemes.map(t => t.theme).join(", ")}
What gets traction: ${params.profile.whatGetsTraction}
Distribution playbook: ${params.profile.distributionPlaybook}
Buyer ratio: ${params.profile.buyerRatio}

Score on 4 dimensions (1-10 each):
- relevance: do their pain themes align with the founder's domain knowledge and keywords?
- credibility: could the founder post here without being an obvious outsider?
- buildability: can the founder realistically build solutions for this community's needs?
- distributionFit: does the community's culture match how the founder likes to engage?

Return JSON: {"score": average_of_4_dimensions, "reason": "one sentence summary", "dimensions": {"relevance": n, "credibility": n, "buildability": n, "distributionFit": n}}`;

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL as string,
      messages: [
        { role: "system", content: "You score Community-Founder Fit (CFF). Return ONLY valid JSON." },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "cff-score", resp.id, userMessage, resp.choices[0].message.content ?? undefined);
    const raw = resp.choices[0].message.content || "{}";
    const parsed = JSON.parse(extractJson(raw)) as CFFData;
    return { ...defaultCFF, ...parsed };
  } catch (err) {
    console.error("computeCFF error:", err);
    return defaultCFF;
  }
}

export interface SubredditCandidate {
  name: string;
  angle: "direct" | "symptom" | "profession" | "adjacent" | "contrast" | "tool";
  reason: string;
}

export async function generateSubredditCandidates(
  founderPrompt: string,
  keywords: string[]
): Promise<SubredditCandidate[]> {
  if (!process.env.OPENROUTER_API_KEY) return [];
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const systemPrompt = `You are an expert Reddit community researcher with deep knowledge of the Reddit ecosystem.
Given a founder's background, generate a comprehensive list of real subreddit names where their target customers gather.

Think across SIX angles:
- direct: Communities named after the exact topic/domain
- symptom: Communities where people express the pain or frustration (not named after the solution)  
- profession: Communities of the profession/role of the person who has this pain
- adjacent: Related topics that attract the same audience with overlapping pain
- contrast: Communities with opposing philosophies - members often frustrated with the status quo and open to new tools
- tool: Communities around existing tools/software that partially solve this problem (users express pain there)

Return ONLY a valid JSON array. No markdown, no explanation.
Format: [{"name":"subredditname","angle":"direct","reason":"one line why"}]
Use the exact subreddit name (no r/ prefix). Aim for 80-100 candidates spread across all six angles.`;

    const userMessage = `Founder background: ${founderPrompt}\n\nKey topics: ${keywords.join(", ")}`;

    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL as string,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "subreddit-gen", resp.id, userMessage, resp.choices[0].message.content ?? undefined);
    const raw = resp.choices[0].message.content || "[]";
    const parsed = JSON.parse(extractJson(raw)) as SubredditCandidate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("generateSubredditCandidates error:", err);
    return [];
  }
}

export async function generatePainSearchQueries(
  domain: string,
  keywords: string[]
): Promise<string[]> {
  if (!process.env.OPENROUTER_API_KEY) return [];
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const resp = await client.chat.completions.create({
      model: PRESCORE_MODEL as string,
      messages: [{
        role: "system",
        content: `You generate Reddit search queries to find posts where people express pain, frustration, or unmet needs in a specific domain.

Use frustration language patterns like:
- "I wish there was"
- "why is there no"
- "does anyone know a tool"
- "I've been manually"
- "built my own spreadsheet"
- "is there anything that"
- "so frustrated with"
- "I just discovered I need"
- "nothing works for"
- "I had to build my own"

Return ONLY a JSON array of 8-12 search query strings. Each query should combine one pattern with a domain-specific term. Short queries work best. No markdown.`
      }, {
        role: "user",
        content: `Domain: ${domain}\nKeywords: ${keywords.slice(0, 8).join(", ")}`
      }],
      temperature: 0.7,
      max_tokens: 512,
    });
    if (resp.usage) trackCost(PRESCORE_MODEL, resp.usage.prompt_tokens, resp.usage.completion_tokens, "pain-queries", resp.id);
    const raw = resp.choices[0].message.content || "[]";
    const parsed = JSON.parse(extractJson(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
