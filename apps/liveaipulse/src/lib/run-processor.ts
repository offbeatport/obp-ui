export async function startRun(): Promise<Response> {
  const { db } = await import("../db/client");
  const { queries, runs, queryResults } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const activeQueries = await db
    .select()
    .from(queries)
    .where(eq(queries.active, true));

  if (activeQueries.length === 0) {
    return new Response(JSON.stringify({ error: "No active queries found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-flash-1.5";
  const runId = crypto.randomUUID();

  await db.insert(runs).values({
    id: runId,
    status: "running",
    model,
    totalQueries: activeQueries.length,
    completedQueries: 0,
  });

  for (const q of activeQueries) {
    await db.insert(queryResults).values({
      id: crypto.randomUUID(),
      runId,
      queryId: q.id,
      queryText: q.text,
      status: "pending",
    });
  }

  setTimeout(() => {
    processRun(runId, activeQueries).catch((err) => {
      console.error("[processRun] fatal error:", err);
    });
  }, 0);

  return new Response(JSON.stringify({ runId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function processRun(
  runId: string,
  activeQueries: Array<{ id: string; text: string; categoryId: string }>,
) {
  const { db } = await import("../db/client");
  const { runs, queryResults, rankings, domainSnapshots, domainNames } = await import("../db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { queryAI } = await import("./openrouter");

  let completedCount = 0;
  const runMentions: Record<string, Record<string, number>> = {};

  for (const query of activeQueries) {
    const [pendingResult] = await db
      .select()
      .from(queryResults)
      .where(and(eq(queryResults.runId, runId), eq(queryResults.queryId, query.id)))
      .limit(1);

    if (!pendingResult) continue;

    // Check for cancellation before each query
    const [currentRun] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId));
    if (currentRun?.status === "cancelled") break;

    try {
      const { response, domains, brandNames } = await queryAI(query.text);

      await db
        .update(queryResults)
        .set({ status: "done", response, extractedDomains: domains })
        .where(eq(queryResults.id, pendingResult.id));

      // Persist brand names (upsert - first seen wins if already set)
      for (const [domain, brandName] of Object.entries(brandNames)) {
        await db
          .insert(domainNames)
          .values({ domain, brandName })
          .onConflictDoNothing();
      }

      for (const domain of domains) {
        if (!runMentions[domain]) runMentions[domain] = {};
        runMentions[domain][query.categoryId] =
          (runMentions[domain][query.categoryId] ?? 0) + 1;

        const existing = await db
          .select()
          .from(rankings)
          .where(and(eq(rankings.domain, domain), eq(rankings.categoryId, query.categoryId)))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(rankings)
            .set({ mentionCount: existing[0].mentionCount + 1, lastSeen: new Date().toISOString() })
            .where(eq(rankings.id, existing[0].id));
        } else {
          await db.insert(rankings).values({
            id: crypto.randomUUID(),
            domain,
            categoryId: query.categoryId,
            mentionCount: 1,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(queryResults)
        .set({ status: "error", error: message })
        .where(eq(queryResults.id, pendingResult.id));
    }

    completedCount++;
    await db.update(runs).set({ completedQueries: completedCount }).where(eq(runs.id, runId));
  }

  for (const [domain, cats] of Object.entries(runMentions)) {
    for (const [categoryId, mentionCount] of Object.entries(cats)) {
      await db.insert(domainSnapshots).values({
        id: crypto.randomUUID(),
        runId,
        domain,
        categoryId,
        mentionCount,
      });
    }
  }

  const [finalRun] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId));
  if (finalRun?.status !== "cancelled") {
    await db.update(runs).set({ status: "done" }).where(eq(runs.id, runId));
  }
  fireEmailAlerts(runId).catch(console.error);
}

async function fireEmailAlerts(runId: string) {
  const { db } = await import("../db/client");
  const { emailAlerts, domainSnapshots } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const snapshots = await db.select().from(domainSnapshots).where(eq(domainSnapshots.runId, runId));
  const alerts = await db.select().from(emailAlerts);

  for (const alert of alerts) {
    const relevant = alert.domain
      ? snapshots.find((s) => s.domain === alert.domain)
      : snapshots[0];
    if (!relevant) continue;
    console.log(`[alerts] Would email ${alert.email} about ${alert.domain ?? "new rankings"}`);
  }
}
