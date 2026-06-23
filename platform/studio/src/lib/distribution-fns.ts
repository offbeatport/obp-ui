import { createServerFn } from "@tanstack/react-start";
import type { OpportunityInsights } from "./types.js";
import { trackCost } from "./cost-tracker.js";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface OppForSelect {
  id: number;
  title: string;
  scoreTotal: number;
  status: string;
  painSummary: string;
  briefMd: string;
  community: string;
  communityUrl: string | null;
  insightsJson: OpportunityInsights | null;
}

export interface DistributionItemWithOpp {
  id: number;
  productId: number;
  opportunityId: number | null;
  opportunityTitle: string | null;
  platform: string;
  title: string | null;
  content: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  postUrl: string | null;
  status: "draft" | "scheduled" | "published";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Opportunities for selector ────────────────────────────────────────────────

export const getOpportunitiesForSelect = createServerFn({ method: "GET" })
  .inputValidator((d: { projectId: number }) => d)
  .handler(async ({ data }): Promise<OppForSelect[]> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        scoreTotal: opportunities.scoreTotal,
        status: opportunities.status,
        painSummary: opportunities.painSummary,
        community: opportunities.community,
        communityUrl: opportunities.communityUrl,
        briefMd: opportunities.briefMd,
        insightsJson: opportunities.insightsJson,
        pass: opportunities.pass,
      })
      .from(opportunities)
      .where(eq(opportunities.projectId, data.projectId))
      .orderBy(desc(opportunities.scoreTotal));

    return rows
      .filter((r) => !r.pass)
      .map((r) => ({
        id: r.id,
        title: r.title,
        scoreTotal: r.scoreTotal,
        status: r.status,
        painSummary: r.painSummary,
        briefMd: r.briefMd,
        community: r.community,
        communityUrl: r.communityUrl,
        insightsJson: r.insightsJson,
      }));
  });

// ── Distribution items ────────────────────────────────────────────────────────

export const getDistributionItems = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<DistributionItemWithOpp[]> => {
    const { db, distributionItems, opportunities } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: distributionItems.id,
        productId: distributionItems.productId,
        opportunityId: distributionItems.opportunityId,
        opportunityTitle: opportunities.title,
        platform: distributionItems.platform,
        title: distributionItems.title,
        content: distributionItems.content,
        scheduledAt: distributionItems.scheduledAt,
        publishedAt: distributionItems.publishedAt,
        postUrl: distributionItems.postUrl,
        status: distributionItems.status,
        notes: distributionItems.notes,
        createdAt: distributionItems.createdAt,
        updatedAt: distributionItems.updatedAt,
      })
      .from(distributionItems)
      .leftJoin(opportunities, eq(distributionItems.opportunityId, opportunities.id))
      .where(eq(distributionItems.productId, data.productId))
      .orderBy(desc(distributionItems.createdAt));

    return rows as DistributionItemWithOpp[];
  });

export const createDistributionItem = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      productId: number;
      opportunityId: number | null;
      platform: string;
      title?: string;
      content: string;
      scheduledAtMs?: number | null;
      status: "draft" | "scheduled" | "published";
      notes?: string;
    }) => d
  )
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, distributionItems } = await import("../db/index.js");

    const [row] = await db
      .insert(distributionItems)
      .values({
        productId: data.productId,
        opportunityId: data.opportunityId ?? null,
        platform: data.platform,
        title: data.title?.trim() || null,
        content: data.content,
        scheduledAt: data.scheduledAtMs ? new Date(data.scheduledAtMs) : null,
        status: data.status,
        notes: data.notes?.trim() || null,
      })
      .returning({ id: distributionItems.id });

    return { id: row.id };
  });

export const updateDistributionItem = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: number;
      title?: string | null;
      content?: string;
      scheduledAtMs?: number | null;
      publishedAtMs?: number | null;
      postUrl?: string | null;
      status?: "draft" | "scheduled" | "published";
      notes?: string | null;
    }) => d
  )
  .handler(async ({ data }): Promise<void> => {
    const { db, distributionItems } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const patch: Partial<typeof distributionItems.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.scheduledAtMs !== undefined)
      patch.scheduledAt = data.scheduledAtMs ? new Date(data.scheduledAtMs) : null;
    if (data.publishedAtMs !== undefined)
      patch.publishedAt = data.publishedAtMs ? new Date(data.publishedAtMs) : null;
    if (data.postUrl !== undefined) patch.postUrl = data.postUrl;
    if (data.status !== undefined) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;

    await db.update(distributionItems).set(patch).where(eq(distributionItems.id, data.id));
  });

export const deleteDistributionItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, distributionItems } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(distributionItems).where(eq(distributionItems.id, data.id));
  });

// ── Content Items (distribution pipeline queue) ───────────────────────────────

export const getContentItems = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { contentItems, distributionPlaybooks, opportunities } = await import("../db/schema.js");
    const { eq, desc, asc } = await import("drizzle-orm");
    const rows = await db
      .select({
        item: contentItems,
        playbookName: distributionPlaybooks.name,
        oppTitle: opportunities.title,
      })
      .from(contentItems)
      .leftJoin(distributionPlaybooks, eq(contentItems.playbookId, distributionPlaybooks.id))
      .leftJoin(opportunities, eq(contentItems.opportunityId, opportunities.id))
      .where(eq(contentItems.productId, data.productId))
      .orderBy(asc(contentItems.sortOrder), desc(contentItems.createdAt));
    return rows.map(r => ({
      ...r.item,
      playbookName: r.playbookName ?? null,
      oppTitle: r.oppTitle ?? null,
      platformMeta: (() => { try { return JSON.parse(r.item.platformMeta); } catch { return {}; } })(),
    }));
  });

export const createContentItem = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; playbookId?: number; opportunityId?: number; platform: string; platformMeta?: Record<string, unknown>; title?: string; content: string; scheduledAt?: Date; sortOrder?: number }) => d)
  .handler(async ({ data }) => {
    const { db, contentItems } = await import("../db/index.js");
    const now = new Date();
    const [row] = await db.insert(contentItems).values({
      productId: data.productId,
      playbookId: data.playbookId ?? null,
      opportunityId: data.opportunityId ?? null,
      platform: data.platform,
      platformMeta: JSON.stringify(data.platformMeta ?? {}),
      status: "pending_review",
      title: data.title ?? null,
      content: data.content,
      scheduledAt: data.scheduledAt ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now, updatedAt: now,
    }).returning();
    return row;
  });

export const updateContentItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; title?: string | null; content?: string; status?: string; scheduledAtMs?: number | null; publishedAtMs?: number | null; postUrl?: string | null; notes?: string | null }) => d)
  .handler(async ({ data }) => {
    const { db, contentItems } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.status !== undefined) patch.status = data.status;
    if (data.scheduledAtMs !== undefined) patch.scheduledAt = data.scheduledAtMs ? new Date(data.scheduledAtMs) : null;
    if (data.publishedAtMs !== undefined) patch.publishedAt = data.publishedAtMs ? new Date(data.publishedAtMs) : null;
    if (data.postUrl !== undefined) patch.postUrl = data.postUrl;
    if (data.notes !== undefined) patch.notes = data.notes;
    await db.update(contentItems).set(patch as any).where(eq(contentItems.id, data.id));
    return { ok: true };
  });

export const deleteContentItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { db, contentItems } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(contentItems).where(eq(contentItems.id, data.id));
    return { ok: true };
  });

export const generateCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; playbookId: number; playbookSlug: string; projectName: string; oppTitle?: string; oppPain?: string; oppBuyer?: string; oppFeatures?: string[]; oppInsights?: Record<string, unknown> }) => d)
  .handler(async ({ data }): Promise<{ count: number }> => {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });
    const model = process.env.OPENROUTER_KEYWORD_MODEL || "anthropic/claude-haiku-4-5";

    const ctx = `Product: "${data.projectName}"
${data.oppTitle ? `Opportunity: ${data.oppTitle}` : ""}
${data.oppPain ? `Pain: ${data.oppPain}` : ""}
${data.oppBuyer ? `Buyer: ${data.oppBuyer}` : ""}
${data.oppFeatures?.length ? `Features:\n${data.oppFeatures.slice(0, 5).map(f => `- ${f}`).join("\n")}` : ""}`;

    const generators: Record<string, () => Promise<Array<{ platform: string; meta: Record<string, unknown>; title?: string; content: string }>>> = {
      "community-posts": async () => {
        const prompt = `You are an expert at authentic community marketing. Write 3 distinct posts for different communities about this product. Each post should feel genuine, not like marketing copy.

${ctx}

Write posts for:
1. r/SaaS or r/entrepreneur (professional founders audience)
2. r/webdev or a niche subreddit relevant to the product
3. Hacker News (Show HN format)

For each post: be specific about the pain, tell a real story, invite discussion. No buzzwords.

Return JSON array:
[
  { "platform": "reddit", "meta": { "subreddit": "SaaS" }, "title": "", "content": "full post content here" },
  { "platform": "reddit", "meta": { "subreddit": "webdev" }, "title": "", "content": "full post content" },
  { "platform": "hn", "meta": {}, "title": "Show HN: Product Name - tagline", "content": "HN comment text" }
]`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
      },

      "newsletter": async () => {
        const prompt = `Write a compelling newsletter edition about this product/opportunity. It should feel like a personal founder update, not marketing.

${ctx}

Write a full newsletter draft with:
- Subject line (punchy, specific)
- Preview text (1 line)
- Body (400-600 words, personal tone, value-first)

Return JSON:
{ "platform": "newsletter", "meta": {}, "title": "Subject line here", "content": "Full body here" }

Return ONLY the JSON object.`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "{}";
        const match = raw.match(/\{[\s\S]*\}/);
        return match ? [JSON.parse(match[0])] : [];
      },

      "free-tool": async () => {
        const prompt = `Generate launch content for a free tool version of this product.

${ctx}

Generate:
1. Product Hunt submission (title + tagline + description)
2. Reddit "I made a free tool" post
3. Twitter/X launch thread (3-5 tweets)

Return JSON array:
[
  { "platform": "ph", "meta": {}, "title": "Tool Name", "content": "Tagline\\n\\nDescription" },
  { "platform": "reddit", "meta": { "subreddit": "SaaS" }, "title": "", "content": "Reddit post" },
  { "platform": "twitter", "meta": {}, "title": "", "content": "Tweet 1\\n\\n---\\n\\nTweet 2\\n\\n---\\n\\nTweet 3" }
]`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
      },

      "viral-artifact": async () => {
        const prompt = `Design the viral artifact strategy for this product - something users will want to share.

${ctx}

Think about:
- What achievement/result do users want to brag about?
- What shareable output can the product generate?

Generate:
1. Artifact concept description (what it looks like, what it shows)
2. Share copy for Twitter
3. Share copy for LinkedIn

Return JSON array:
[
  { "platform": "twitter", "meta": { "type": "artifact-share" }, "title": "Artifact concept", "content": "Here is what the shareable artifact should contain and look like:\\n[description]\\n\\nShare copy: [tweet text with template variables]" },
  { "platform": "twitter", "meta": { "type": "share-copy" }, "title": "", "content": "[Twitter share copy using artifact]" },
  { "platform": "linkedin", "meta": {}, "title": "", "content": "[LinkedIn share copy using artifact]" }
]`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.8 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
      },

      "aeo": async () => {
        const prompt = `Generate Answer Engine Optimization content for this product - content that gets cited by ChatGPT, Perplexity, and AI search.

${ctx}

Generate:
1. 8 FAQ pairs (question + direct, specific answer) - questions buyers actually ask
2. One comparison table (Product vs 2 competitors) in markdown

Return JSON array:
[
  { "platform": "seo", "meta": { "type": "faq" }, "title": "FAQ: [Topic]", "content": "**Q: ...**\\nA: ...\\n\\n**Q: ...**\\nA: ..." },
  { "platform": "seo", "meta": { "type": "comparison" }, "title": "Comparison: [Product] vs Alternatives", "content": "| Feature | [Product] | [Competitor 1] | [Competitor 2] |\\n|---|---|---|---|\\n..." }
]`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.4 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
      },

      "content-repurposing": async () => {
        const prompt = `Generate repurposed content pieces from the core product story. Pretend there is one pillar piece of content (a founder story + product explanation) and repurpose it into multiple formats.

${ctx}

Generate:
1. 5 tweets (separate with ---)
2. 2 LinkedIn posts
3. 1 short-form video script (60 seconds)
4. 3 quote graphics (just the quote text)

Return JSON array of separate items:
[
  { "platform": "twitter", "meta": { "type": "thread" }, "title": "Tweet batch", "content": "tweet 1\\n---\\ntweet 2\\n---\\ntweet 3\\n---\\ntweet 4\\n---\\ntweet 5" },
  { "platform": "linkedin", "meta": {}, "title": "", "content": "linkedin post 1" },
  { "platform": "linkedin", "meta": {}, "title": "", "content": "linkedin post 2" },
  { "platform": "youtube", "meta": { "type": "script" }, "title": "60-second script", "content": "script here" },
  { "platform": "twitter", "meta": { "type": "quote" }, "title": "Quote graphics", "content": "quote 1\\n---\\nquote 2\\n---\\nquote 3" }
]`;
        const r = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature: 0.8 });
        if (r.usage) trackCost(model, r.usage.prompt_tokens, r.usage.completion_tokens, "content-gen", r.id, prompt, r.choices[0].message.content ?? undefined);
        const raw = r.choices[0].message.content || "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
      },
    };

    const generator = generators[data.playbookSlug];
    if (!generator) return { count: 0 };

    const items = await generator();
    if (!items.length) return { count: 0 };

    const { contentItems } = await import("../db/schema.js");
    const { db: dbConn } = await import("../db/index.js");
    const now = new Date();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await dbConn.insert(contentItems).values({
        productId: data.productId,
        playbookId: data.playbookId,
        opportunityId: null,
        platform: item.platform,
        platformMeta: JSON.stringify(item.meta ?? {}),
        status: "pending_review",
        title: item.title || null,
        content: item.content,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count: items.length };
  });

// ── Global queue - all projects ───────────────────────────────────────────────

export const getGlobalQueue = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db/index.js");
    const { contentItems, distributionPlaybooks, projectPlaybookInstances, products } = await import("../db/schema.js");
    const { eq, and, lte, gte, inArray, or } = await import("drizzle-orm");

    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    // 1. Items pending review
    const toReview = await db
      .select({ item: contentItems, projectName: products.name, projectId: products.id })
      .from(contentItems)
      .innerJoin(products, eq(contentItems.productId, products.id))
      .where(eq(contentItems.status, "pending_review"))
      .orderBy(contentItems.createdAt);

    // 2. Scheduled for today
    const toPost = await db
      .select({ item: contentItems, projectName: products.name, projectId: products.id })
      .from(contentItems)
      .innerJoin(products, eq(contentItems.productId, products.id))
      .where(and(eq(contentItems.status, "scheduled"), gte(contentItems.scheduledAt, todayStart), lte(contentItems.scheduledAt, todayEnd)))
      .orderBy(contentItems.scheduledAt);

    // 3. Active strategies that have never generated content
    const activeInstances = await db
      .select({ instance: projectPlaybookInstances, playbook: distributionPlaybooks, projectName: products.name, projectId: products.id })
      .from(projectPlaybookInstances)
      .innerJoin(distributionPlaybooks, eq(projectPlaybookInstances.playbookId, distributionPlaybooks.id))
      .innerJoin(products, eq(projectPlaybookInstances.productId, products.id))
      .where(eq(projectPlaybookInstances.isActive, true));

    // Check which have generated content
    const activePlaybookPairs = activeInstances.map(r => ({ projectId: r.projectId, playbookId: r.instance.playbookId }));
    const toGenerate: typeof activeInstances = [];
    const generatableSlugs = new Set(["community-posts", "newsletter", "free-tool", "viral-artifact", "aeo", "content-repurposing"]);
    for (const r of activeInstances) {
      if (!generatableSlugs.has(r.playbook.slug)) continue;
      const existing = await db.select({ id: contentItems.id }).from(contentItems)
        .where(and(eq(contentItems.productId, r.projectId), eq(contentItems.playbookId, r.instance.playbookId)))
        .limit(1);
      if (existing.length === 0) toGenerate.push(r);
    }

    return {
      toReview: toReview.map(r => ({ ...r.item, projectName: r.projectName, projectId: r.projectId })),
      toPost: toPost.map(r => ({ ...r.item, projectName: r.projectName, projectId: r.projectId })),
      toGenerate: toGenerate.map(r => ({ playbookId: r.instance.playbookId, playbookSlug: r.playbook.slug, playbookName: r.playbook.name, instanceId: r.instance.id, projectId: r.projectId, projectName: r.projectName })),
    };
  });
