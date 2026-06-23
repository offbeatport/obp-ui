import { createServerFn } from "@tanstack/react-start";
import type { AiTaskConfig } from "../db/schema.js";

export const AI_TASK_KEYS = ["build", "opportunity", "scoring", "summaries", "channels", "distribution", "discovery"] as const;

export const AI_TASK_LABELS: Record<string, { label: string; desc: string }> = {
  build: { label: "Build", desc: "Scaffolding & building the product (V1 code)" },
  opportunity: { label: "Opportunity / Playbook", desc: "Briefs, insights, opportunity generation & refinement" },
  scoring: { label: "Scoring & Clustering", desc: "Signal pre-scoring, clustering, fit scoring" },
  summaries: { label: "Summaries (cheap)", desc: "Short summaries, keywords, domain names — use a cheap model" },
  channels: { label: "Channels", desc: "Channel config, subreddit & query generation" },
  distribution: { label: "Distribution", desc: "Content/campaign generation, replies" },
  discovery: { label: "Discovery", desc: "Market scans, verticals, gap analysis, SEO" },
};

export const getAiTaskConfigs = createServerFn({ method: "GET" })
  .handler(async (): Promise<AiTaskConfig[]> => {
    const { db, aiTaskConfig } = await import("../db/index.js");
    const { asc } = await import("drizzle-orm");
    const rows = await db.select().from(aiTaskConfig).orderBy(asc(aiTaskConfig.id));
    // Ensure all keys exist (seed missing)
    const have = new Set(rows.map((r) => r.taskKey));
    const now = new Date();
    const missing = AI_TASK_KEYS.filter((k) => !have.has(k));
    if (missing.length) {
      await db.insert(aiTaskConfig).values(missing.map((k) => ({ taskKey: k, tool: "cli" as const, createdAt: now, updatedAt: now })));
      return db.select().from(aiTaskConfig).orderBy(asc(aiTaskConfig.id));
    }
    return rows;
  });

export const updateAiTaskConfig = createServerFn({ method: "POST" })
  .inputValidator((d: { taskKey: string; tool: "cli" | "openrouter"; cliBin?: string | null; model?: string | null }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, aiTaskConfig } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(aiTaskConfig)
      .set({ tool: data.tool, cliBin: data.cliBin ?? null, model: data.model ?? null, updatedAt: new Date() })
      .where(eq(aiTaskConfig.taskKey, data.taskKey));
    // Invalidate the in-process cache so the new routing takes effect immediately.
    const { clearAiConfigCache } = await import("./ai.js");
    clearAiConfigCache();
  });
