import { createFileRoute } from "@tanstack/react-router";
import {
  applyMapping,
  buildMappingPrompt,
  detectPlatform,
  fingerprint,
  heuristicMapping,
  parseCSV,
  parseMappingResponse,
  rowsToCSV,
  type CanonicalColumn,
  type NormalizeResult,
  type SchemaChange,
} from "../../features/normalizer";

const ANON_DAILY_LIMIT = 3;
const FREE_DAILY_LIMIT = 10;
const PAID_DAILY_LIMIT = 1000;

export const Route = (createFileRoute("/api/normalize") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { db } = await import("../../db/client");
        const { runs, usageDay, platformMappings } = await import("../../db/schema");
        const { and, eq, desc } = await import("drizzle-orm");
        const { auth } = await import("../../lib/auth");

        // ── Auth / rate-limit ─────────────────────────────────────────
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user?.id ?? null;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        const ownerKey = userId ?? `ip:${ip}`;
        const today = new Date().toISOString().slice(0, 10);

        const existing = await db
          .select()
          .from(usageDay)
          .where(and(eq(usageDay.ownerKey, ownerKey), eq(usageDay.date, today)))
          .get();

        const count = existing?.count ?? 0;
        const tier = userId ? "free" : "anon";
        const limit = tier === "anon" ? ANON_DAILY_LIMIT : tier === "free" ? FREE_DAILY_LIMIT : PAID_DAILY_LIMIT;

        if (count >= limit) {
          return new Response(
            JSON.stringify({ error: `Daily limit reached (${limit} normalizations). Sign in for more.`, remaining: 0 }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Parse multipart ───────────────────────────────────────────
        let formData: FormData;
        try { formData = await request.formData(); }
        catch {
          return new Response(JSON.stringify({ error: "Invalid form data." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const fileEntries = formData.getAll("files") as File[];
        if (!fileEntries.length) {
          return new Response(JSON.stringify({ error: "No files uploaded." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (fileEntries.length > 10) {
          return new Response(JSON.stringify({ error: "Maximum 10 files per run." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // User-supplied override mappings: { [fileName]: { [srcCol]: canonicalCol | null } }
        const mappingOverridesRaw = formData.get("mappingOverrides");
        const mappingOverrides: Record<string, Record<string, CanonicalColumn | null>> =
          mappingOverridesRaw ? JSON.parse(mappingOverridesRaw as string) : {};

        // Whether to persist the overrides to platform_mappings
        const saveMappings = formData.get("saveMappings") === "true";

        const filesData: Array<{ name: string; content: string }> = [];
        for (const file of fileEntries) {
          if (!file.name.toLowerCase().endsWith(".csv")) {
            return new Response(JSON.stringify({ error: `${file.name} is not a CSV file.` }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: `${file.name} exceeds the 5 MB limit.` }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          filesData.push({ name: file.name, content: await file.text() });
        }

        // ── Load saved mappings for this user ─────────────────────────
        // { platform → { srcCol → canonicalCol | null } }
        const savedMappings: Record<string, Record<string, CanonicalColumn | null>> = {};
        if (userId) {
          const rows = await db.select().from(platformMappings).where(eq(platformMappings.userId, userId));
          for (const row of rows) {
            savedMappings[row.platform] = row.overrides as Record<string, CanonicalColumn | null>;
          }
        }

        // ── Fetch previous run for diff + schema change detection ─────
        const prevRun = userId
          ? await db.select().from(runs).where(eq(runs.userId, userId)).orderBy(desc(runs.createdAt)).limit(1).get()
          : null;
        const prevFingerprints: Record<string, string> = (prevRun?.columnFingerprints as Record<string, string>) ?? {};

        // ── Normalize each file ───────────────────────────────────────
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
        const allRows: ReturnType<typeof applyMapping> = [];
        const platformsDetected: string[] = [];
        const columnMappings: Record<string, Record<string, CanonicalColumn | null>> = {};
        const columnFingerprints: Record<string, string> = {};
        const warnings: string[] = [];
        const schemaChanges: SchemaChange[] = [];
        // Track which platform each file belongs to (needed for saving overrides)
        const filePlatformMap: Record<string, string> = {};

        for (const file of filesData) {
          const { headers, rows } = parseCSV(file.content);
          if (!headers.length) { warnings.push(`${file.name}: empty or unreadable, skipped.`); continue; }

          const platform = detectPlatform(file.name, headers);
          filePlatformMap[file.name] = platform;
          if (!platformsDetected.includes(platform)) platformsDetected.push(platform);

          const fp = fingerprint(headers);
          columnFingerprints[platform] = fp;
          if (prevFingerprints[platform] && prevFingerprints[platform] !== fp) {
            schemaChanges.push({ platform, message: `${platform} column structure changed since last run. Check mappings.` });
          }

          // Layer 1: LLM or heuristic base mapping
          let baseMapping: Record<string, CanonicalColumn | null>;
          if (OPENROUTER_API_KEY) {
            try {
              const prompt = buildMappingPrompt(platform, headers);
              const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "google/gemini-3.1-flash-lite", messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 512 }),
              });
              const llmJson = (await llmRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
              baseMapping = parseMappingResponse(llmJson.choices?.[0]?.message?.content ?? "", headers);
            } catch {
              warnings.push(`${file.name}: LLM unavailable, using heuristic mapping.`);
              baseMapping = heuristicMapping(headers);
            }
          } else {
            baseMapping = heuristicMapping(headers);
          }

          // Layer 2: Apply saved platform overrides on top of base
          const saved = savedMappings[platform] ?? {};
          const afterSaved: Record<string, CanonicalColumn | null> = { ...baseMapping };
          for (const [src, canon] of Object.entries(saved)) {
            if (headers.includes(src)) afterSaved[src] = canon;
          }

          // Layer 3: Apply explicit per-run overrides (highest priority)
          const explicit = mappingOverrides[file.name] ?? {};
          const finalMapping: Record<string, CanonicalColumn | null> = { ...afterSaved };
          for (const [src, canon] of Object.entries(explicit)) {
            if (headers.includes(src)) finalMapping[src] = canon;
          }

          columnMappings[file.name] = finalMapping;
          allRows.push(...applyMapping(headers, rows, finalMapping, platform));
        }

        // ── Save overrides to platform_mappings ───────────────────────
        if (userId && saveMappings && Object.keys(mappingOverrides).length > 0) {
          for (const [fileName, overrides] of Object.entries(mappingOverrides)) {
            const platform = filePlatformMap[fileName];
            if (!platform || !Object.keys(overrides).length) continue;

            const existingSaved = await db
              .select()
              .from(platformMappings)
              .where(and(eq(platformMappings.userId, userId), eq(platformMappings.platform, platform)))
              .get();

            const merged = { ...(existingSaved?.overrides ?? {}), ...overrides } as Record<string, CanonicalColumn | null>;

            if (existingSaved) {
              await db.update(platformMappings).set({ overrides: merged }).where(eq(platformMappings.id, existingSaved.id));
            } else {
              await db.insert(platformMappings).values({ id: crypto.randomUUID(), userId, platform, overrides: merged });
            }
          }
        }

        // ── Increment usage ───────────────────────────────────────────
        if (existing) {
          await db.update(usageDay).set({ count: count + 1 }).where(eq(usageDay.id, existing.id));
        } else {
          await db.insert(usageDay).values({ id: crypto.randomUUID(), ownerKey, date: today, count: 1 });
        }

        // ── Persist run ───────────────────────────────────────────────
        const runId = crypto.randomUUID();
        await db.insert(runs).values({
          id: runId,
          userId,
          anonId: userId ? null : ownerKey,
          inputFileNames: filesData.map((f) => f.name),
          rowCount: allRows.length,
          prevRowCount: prevRun?.rowCount ?? null,
          platformsDetected,
          columnFingerprints,
          schemaChanges,
          outputRows: allRows,
          warnings,
        });

        // ── Respond ───────────────────────────────────────────────────
        const result: NormalizeResult & { csv: string; remaining: number; schemaChanges: SchemaChange[]; rowDiff: number | null; runId: string | null } = {
          rows: allRows,
          platformsDetected,
          columnMappings,
          columnFingerprints,
          warnings,
          schemaChanges,
          csv: rowsToCSV(allRows),
          remaining: limit - count - 1,
          rowDiff: prevRun ? allRows.length - prevRun.rowCount : null,
          runId: userId ? runId : null,
        };

        return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
