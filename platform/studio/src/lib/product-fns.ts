import { createServerFn } from "@tanstack/react-start";
import type { Product } from "../db/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Products are promoted EXPLICITLY from an Idea (projects row). A product owns
// all build/deploy/monetize state and the build/launch/monitor child tables.
// NOTE: SQLite foreign-key enforcement is OFF in this app (see db/index.ts), so
// every cascade below is hand-rolled. Keep this list COMPLETE or rows leak.
// ─────────────────────────────────────────────────────────────────────────────

/** Delete every child row owned by a product (plain helper, not a server fn). */
export async function deleteProductData(productId: number): Promise<void> {
  const { db } = await import("../db/index.js");
  const {
    projectVersions, features, distributionItems, distributionPosts, launchPlans,
    userFeedback, seoPages, contentItems, projectPlaybookInstances,
    mrrSnapshots, cacEntries, trafficSnapshots, channels, seoRuns,
  } = await import("../db/schema.js");
  const { eq } = await import("drizzle-orm");

  await db.delete(launchPlans).where(eq(launchPlans.productId, productId));
  await db.delete(features).where(eq(features.productId, productId));
  await db.delete(projectVersions).where(eq(projectVersions.productId, productId));
  await db.delete(distributionItems).where(eq(distributionItems.productId, productId));
  await db.delete(distributionPosts).where(eq(distributionPosts.productId, productId));
  await db.delete(userFeedback).where(eq(userFeedback.productId, productId));
  await db.delete(seoPages).where(eq(seoPages.productId, productId));
  await db.delete(contentItems).where(eq(contentItems.productId, productId));
  await db.delete(projectPlaybookInstances).where(eq(projectPlaybookInstances.productId, productId));
  await db.delete(mrrSnapshots).where(eq(mrrSnapshots.productId, productId));
  await db.delete(cacEntries).where(eq(cacEntries.productId, productId));
  await db.delete(trafficSnapshots).where(eq(trafficSnapshots.productId, productId));
  // distribution-owned channels + seo runs (dual-owned tables)
  await db.delete(channels).where(eq(channels.productId, productId));
  await db.delete(seoRuns).where(eq(seoRuns.productId, productId));
}

/** Delete all products of an idea, with their full child cascade. */
export async function deleteProductsForIdea(ideaId: number): Promise<void> {
  const { db } = await import("../db/index.js");
  const { products } = await import("../db/schema.js");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.ideaId, ideaId));
  for (const r of rows) await deleteProductData(r.id);
  await db.delete(products).where(eq(products.ideaId, ideaId));
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** Explicit promotion: create a Product from an Idea (+ optional source opportunity). */
export const createProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      ideaId: number;
      opportunityId?: number;
      name?: string;          // defaults to the idea's name
      handle?: string;
      domain?: string;
      techStackId?: number;
      designDirection?: string;
    }) => d
  )
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, products, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    let name = data.name;
    if (!name) {
      const [idea] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, data.ideaId));
      name = idea?.name ?? "Untitled product";
    }

    const [row] = await db
      .insert(products)
      .values({
        ideaId: data.ideaId,
        opportunityId: data.opportunityId,
        name,
        handle: data.handle,
        domain: data.domain,
        techStackId: data.techStackId,
        designDirection: data.designDirection,
      })
      .returning({ id: products.id });

    return { id: row.id };
  });

/**
 * Provision a product from the New Product flow: ensures an Idea exists
 * (creates one, or reuses the opportunity's idea), then creates the product.
 * Returns the new productId + ideaId. Domain is recorded (intent), not purchased.
 */
export const provisionProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; opportunityId?: number; domain?: string; designDirection?: string; techStackId?: number; handle?: string }) => d)
  .handler(async ({ data }): Promise<{ productId: number; ideaId: number }> => {
    const { db, projects, opportunities, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    let ideaId: number;
    if (data.opportunityId) {
      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, data.opportunityId));
      if (opp?.projectId) {
        ideaId = opp.projectId;
      } else {
        const [idea] = await db.insert(projects).values({ name: data.name, hypothesis: opp?.painSummary ?? null }).returning({ id: projects.id });
        ideaId = idea.id;
        await db.update(opportunities).set({ projectId: ideaId }).where(eq(opportunities.id, data.opportunityId));
      }
    } else {
      const [idea] = await db.insert(projects).values({ name: data.name }).returning({ id: projects.id });
      ideaId = idea.id;
    }

    const handle = (data.handle || data.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const [prod] = await db.insert(products).values({
      ideaId,
      opportunityId: data.opportunityId ?? null,
      name: data.name,
      handle,
      domain: data.domain ?? null,
      designDirection: data.designDirection ?? null,
      techStackId: data.techStackId ?? null,
    }).returning({ id: products.id });

    return { productId: prod.id, ideaId };
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<Product | null> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(products).where(eq(products.id, data.id));
    return row ?? null;
  });

export const getProductsForIdea = createServerFn({ method: "GET" })
  .inputValidator((d: { ideaId: number }) => d)
  .handler(async ({ data }): Promise<Product[]> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    return db.select().from(products).where(eq(products.ideaId, data.ideaId));
  });

export const listProducts = createServerFn({ method: "GET" })
  .handler(async (): Promise<Product[]> => {
    const { db, products } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(products).orderBy(desc(products.createdAt));
  });

export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { id: number } & Partial<{
      name: string;
      handle: string;
      domain: string;
      status: "active" | "paused" | "archived";
      deployStatus: "draft" | "deploying" | "deployed" | "failed";
      repoUrl: string;
      coolifyAppId: string;
      cloudflareZoneId: string;
      vpsIp: string;
      techStackId: number;
      designDirection: string;
      twitterHandle: string;
      paymentProcessor: string;
      pricingModel: string;
      pricePointCents: number;
      trialDays: number;
      hasFree: boolean;
      checkoutUrl: string;
      targetMrrCents: number;
      sortOrder: number;
    }>) => d
  )
  .handler(async ({ data }): Promise<void> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const { id, ...fields } = data;
    await db.update(products).set({ ...fields, updatedAt: new Date() }).where(eq(products.id, id));
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await deleteProductData(data.id);
    await db.delete(products).where(eq(products.id, data.id));
  });
