/**
 * Deduplicates opportunities with the same normalized title.
 * Keeps the oldest row (lowest id), merges signals into it, deletes the rest.
 * Run once: npx tsx scripts/cleanup-dupes.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function main() {
  const { eq, inArray, sql } = await import("drizzle-orm");

  const all = await db
    .select({ id: schema.opportunities.id, title: schema.opportunities.title })
    .from(schema.opportunities)
    .orderBy(schema.opportunities.id);

  // Group by normalized title
  const groups = new Map<string, number[]>();
  for (const opp of all) {
    const key = normalizeTitle(opp.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(opp.id);
  }

  let mergedGroups = 0;
  let deletedRows = 0;

  for (const [title, ids] of groups) {
    if (ids.length < 2) continue;

    const keepId = ids[0]; // oldest
    const dupeIds = ids.slice(1);

    console.log(`Deduping "${title.slice(0, 60)}" - keeping #${keepId}, merging+deleting ${dupeIds.join(", ")}`);

    // Move all signals from dupes to keeper (ignore conflicts)
    for (const dupeId of dupeIds) {
      const dupeSignals = await db
        .select({ signalId: schema.opportunitySignals.signalId })
        .from(schema.opportunitySignals)
        .where(eq(schema.opportunitySignals.opportunityId, dupeId));

      const existingLinks = await db
        .select({ signalId: schema.opportunitySignals.signalId })
        .from(schema.opportunitySignals)
        .where(eq(schema.opportunitySignals.opportunityId, keepId));

      const existingSet = new Set(existingLinks.map((r) => r.signalId));

      for (const { signalId } of dupeSignals) {
        if (!existingSet.has(signalId)) {
          await db.insert(schema.opportunitySignals).values({ opportunityId: keepId, signalId });
        }
      }
    }

    // Update signal count on keeper
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.opportunitySignals)
      .where(eq(schema.opportunitySignals.opportunityId, keepId));
    await db.update(schema.opportunities)
      .set({ signalCount: Number(count), updatedAt: new Date() })
      .where(eq(schema.opportunities.id, keepId));

    // Delete dupes (cascade removes their opportunitySignals rows)
    await db.delete(schema.opportunities).where(inArray(schema.opportunities.id, dupeIds));

    mergedGroups++;
    deletedRows += dupeIds.length;
  }

  console.log(`\nDone. Merged ${mergedGroups} groups, deleted ${deletedRows} duplicate opportunities.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
