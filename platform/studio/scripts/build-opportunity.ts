/**
 * Build pipeline for a single opportunity.
 * Steps:
 *   1. Load opportunity from DB (generate brief if missing)
 *   2. Build full markdown snapshot
 *   3. Generate 5 product ideas via Claude CLI (generate-ideas skill)
 *   4. Extract top idea (#1)
 *   5. Generate implementation plans via Claude CLI (generate-idea-plans skill)
 *   6. Extract plan #1
 *   7. Create builds/opp-{id}-{slug}/ with PLAN.md, IDEAS.md, ALL_PLANS.md
 *   8. Implement via: claude --dangerously-skip-permissions -p in that directory
 *
 * Usage: OPPORTUNITY_ID=42 npx tsx scripts/build-opportunity.ts
 */
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const OPPORTUNITY_ID = parseInt(process.env.OPPORTUNITY_ID || "0", 10);
if (!OPPORTUNITY_ID) {
  console.error("OPPORTUNITY_ID env var required");
  process.exit(1);
}
const DESIGN_OUTPUT = process.env.DESIGN_OUTPUT || "";
const TECH_STACK = process.env.TECH_STACK || "";
const CUSTOM_PROMPT = process.env.CUSTOM_PROMPT || "";

const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getOpportunity(id: number) {
  const { db, opportunities, opportunitySignals, signals } = await import("../src/db/index.js");
  const { eq } = await import("drizzle-orm");

  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  if (!opp) return null;

  const linkedSignals = await db
    .select({ signal: signals })
    .from(opportunitySignals)
    .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
    .where(eq(opportunitySignals.opportunityId, id));

  return { ...opp, signals: linkedSignals.map((r) => r.signal) };
}

async function saveBriefToDb(id: number, briefMd: string, insightsJson: object) {
  const { db, opportunities } = await import("../src/db/index.js");
  const { eq } = await import("drizzle-orm");
  await db.update(opportunities)
    .set({ briefMd, insightsJson, updatedAt: new Date() })
    .where(eq(opportunities.id, id));
}

// ---------------------------------------------------------------------------
// Claude CLI helpers
// ---------------------------------------------------------------------------

// Streams claude output to stdout (visible in logs) while accumulating the full response.
function callClaude(prompt: string): Promise<string> {
  return new Promise((done, reject) => {
    const child = spawn("claude", ["-p", prompt], {
      cwd: resolve(__dirname, ".."),
      env: process.env,
    });

    let accumulated = "";
    let lastLine = "";

    const handleChunk = (chunk: Buffer, toStderr = false) => {
      const text = chunk.toString();
      accumulated += text;
      // Stream each line to parent process so vite.config picks it up
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
          lastLine += lines[i];
        } else {
          if (lastLine.trim()) process.stdout.write(lastLine + "\n");
          lastLine = lines[i];
        }
      }
    };

    child.stdout.on("data", (c: Buffer) => handleChunk(c));
    child.stderr.on("data", (c: Buffer) => handleChunk(c, true));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI timed out after ${CLAUDE_TIMEOUT_MS / 60000}m`));
    }, CLAUDE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (lastLine.trim()) process.stdout.write(lastLine + "\n");
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}`));
      } else {
        done(accumulated.trim());
      }
    });

    child.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

function spawnAndStream(args: string[], cwd: string): Promise<number> {
  return new Promise((res) => {
    const child = spawn("claude", args, { cwd, env: process.env });
    child.stdout.on("data", (c: Buffer) => process.stdout.write(c));
    child.stderr.on("data", (c: Buffer) => process.stderr.write(c));
    child.on("close", (code) => res(code ?? 1));
    child.on("error", (err) => {
      console.error(`[spawn error] ${err.message}`);
      res(1);
    });
  });
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(opp: Awaited<ReturnType<typeof getOpportunity>> & object): string {
  const ins = (opp as any).insightsJson ?? {};
  const scores = (opp as any).scoresJson ?? {};
  const fmt = (n?: number) => n ? (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`) : null;

  const lines: string[] = [];
  lines.push(`# ${(opp as any).title}`);
  lines.push(`\n**Pain:** ${(opp as any).painSummary}`);
  lines.push(`**Sector:** ${(opp as any).sector} | **Community:** ${(opp as any).community}${(opp as any).communityUrl ? ` (${(opp as any).communityUrl})` : ""}`);
  lines.push(`**Score:** ${(opp as any).scoreTotal.toFixed(1)}/10 | **Signals:** ${(opp as any).signalCount}`);

  const scoreLabels: Record<string, string> = {
    buyer_quality: "Buyer Quality", pain_urgency: "Pain Urgency",
    willingness_to_pay: "Willingness to Pay", viral_potential: "Viral Potential",
    build_simplicity: "Build Simplicity", distribution_ready: "Distribution Ready",
    moat_potential: "Moat Potential", revenue_potential: "Revenue Potential",
  };
  lines.push(`\n## Scores`);
  for (const [k, label] of Object.entries(scoreLabels)) {
    if (scores[k] !== undefined) lines.push(`- **${label}:** ${scores[k]}/10`);
  }

  if (ins.mrr_low || ins.mrr_high) {
    const parts = [fmt(ins.mrr_low), fmt(ins.mrr_high)].filter(Boolean);
    lines.push(`\n## MRR Estimate: ${parts.join(" – ")}/mo (avg ${fmt(ins.mrr_avg)})`);
  }
  if (ins.buyer_persona) lines.push(`\n## Buyer\n${ins.buyer_persona}`);
  if (ins.hidden_need) lines.push(`\n## Hidden Need\n${ins.hidden_need}`);
  if (ins.self_growth) lines.push(`\n## Self-Growth\n${ins.self_growth}`);
  if (ins.distribution_primary) lines.push(`\n## Distribution\n${ins.distribution_primary}`);
  if (ins.price_anchor) lines.push(`\n## Price Signal\n${ins.price_anchor}`);

  if (ins.v1_features?.length) {
    lines.push(`\n## V1 Features`);
    ins.v1_features.forEach((f: string) => lines.push(`- ${f}`));
  }
  if (ins.risks?.length) {
    lines.push(`\n## Risks`);
    ins.risks.forEach((r: string) => lines.push(`- ${r}`));
  }
  if (ins.competitors?.length) {
    lines.push(`\n## Competitors`);
    ins.competitors.forEach((c: string) => lines.push(`- ${c}`));
  }
  if (ins.wtp_evidence?.length) {
    lines.push(`\n## Demand Proof (WTP Evidence)`);
    ins.wtp_evidence.forEach((e: any) => lines.push(`- **[${e.source} / ${e.type}]** "${e.excerpt}"`));
  }

  const briefMd = (opp as any).briefMd;
  if (briefMd && !briefMd.startsWith("Brief generation failed") && briefMd.trim()) {
    lines.push(`\n---\n${briefMd}`);
  }

  const sigs = (opp as any).signals ?? [];
  if (sigs.length) {
    lines.push(`\n## Source Signals (${sigs.length})`);
    sigs.slice(0, 20).forEach((s: any) => {
      lines.push(`\n**[${s.source}]** ${s.url || "(no url)"}`);
      lines.push(s.rawText.slice(0, 400));
    });
    if (sigs.length > 20) lines.push(`\n_…and ${sigs.length - 20} more signals_`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractTopIdea(output: string): string {
  const m = output.match(/#1[\s\S]+?(?=\n#2\s|\n## |$)/);
  return m ? m[0].trim() : output.slice(0, 3000);
}

function extractTopPlan(output: string): string {
  const m = output.match(/(?:^|\n)(?:#+\s*)?(?:Plan\s+(?:#?\s*)?1\b|#1\s)[\s\S]+?(?=\n(?:#+\s*)?(?:Plan\s+(?:#?\s*)?2\b|#2\s)|$)/i);
  return m ? m[0].trim() : output.slice(0, 4000);
}

function readSkill(path: string): string {
  const content = readFileSync(path, "utf8");
  return content.replace(/^---[\s\S]+?---\n/, "").trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${"═".repeat(56)}`);
  console.log(`BUILD PIPELINE - Opportunity #${OPPORTUNITY_ID}`);
  console.log(`${"═".repeat(56)}\n`);

  // Step 1: load opportunity
  console.log(`[1/7] Loading opportunity #${OPPORTUNITY_ID}...`);
  const opp = await getOpportunity(OPPORTUNITY_ID);
  if (!opp) {
    console.error("  → Opportunity not found");
    process.exit(1);
  }
  console.log(`  → "${(opp as any).title}" (score: ${(opp as any).scoreTotal.toFixed(1)})`);

  // Step 1b: ensure brief exists
  const briefMd = (opp as any).briefMd ?? "";
  const hasBrief = briefMd && !briefMd.startsWith("Brief generation failed") && briefMd.trim() !== "";
  if (!hasBrief) {
    console.log(`\n[1b] Brief missing - generating now (2 LLM calls)...`);
    const { generateBrief, extractInsights } = await import("../src/lib/ai.js");
    try {
      const generated = await generateBrief((opp as any).title, (opp as any).painSummary, (opp as any).signals);
      const insights = await extractInsights((opp as any).title, generated);
      const merged = { ...((opp as any).insightsJson ?? {}), ...(insights ?? {}) };
      await saveBriefToDb(OPPORTUNITY_ID, generated, merged);
      (opp as any).briefMd = generated;
      (opp as any).insightsJson = merged;
      console.log(`  → Brief generated (${generated.length} chars)`);
    } catch (err: any) {
      console.log(`  → Brief generation failed: ${err.message} - continuing without brief`);
    }
  } else {
    console.log(`  → Brief already exists`);
  }

  // Step 2: build markdown
  console.log(`\n[2/7] Building opportunity markdown...`);
  const markdown = buildMarkdown(opp as any);
  console.log(`  → ${markdown.length} chars`);

  // Load skill prompts
  const home = process.env.HOME!;
  const ideasSkillPath = resolve(home, ".claude/skills/generate-ideas/SKILL.md");
  const plansSkillPath = resolve(home, ".claude/skills/generate-idea-plans/SKILL.md");

  if (!existsSync(ideasSkillPath) || !existsSync(plansSkillPath)) {
    console.error("  → Skill files not found at ~/.claude/skills/");
    process.exit(1);
  }

  const ideasSkill = readSkill(ideasSkillPath);
  const plansSkill = readSkill(plansSkillPath);

  // Step 3: generate ideas via Claude CLI
  console.log(`\n[3/7] Generating product ideas (Claude CLI)...`);
  console.log(`  → This may take 2-5 minutes...`);

  let ideasOutput: string;
  try {
    ideasOutput = await callClaude(`${ideasSkill}\n\nARGUMENTS: ${markdown}`);
    console.log(`  → Ideas received (${ideasOutput.length} chars)`);
    ideasOutput.split("\n").filter((l) => /^#\d/.test(l.trim())).slice(0, 5)
      .forEach((l) => console.log(`    ${l.slice(0, 90)}`));
  } catch (err: any) {
    console.error(`  → Ideas generation failed: ${err.message}`);
    process.exit(1);
  }

  // Step 4: extract top idea
  console.log(`\n[4/7] Extracting idea #1...`);
  const topIdea = extractTopIdea(ideasOutput);
  console.log(`  → ${topIdea.split("\n")[0].slice(0, 90)}`);

  // Step 5: generate plans via Claude CLI
  console.log(`\n[5/7] Generating implementation plans (Claude CLI)...`);
  console.log(`  → This may take 2-5 minutes...`);

  let plansOutput: string;
  try {
    plansOutput = await callClaude(`${plansSkill}\n\nARGUMENTS: ${topIdea}`);
    console.log(`  → Plans received (${plansOutput.length} chars)`);
  } catch (err: any) {
    console.error(`  → Plans generation failed: ${err.message}`);
    process.exit(1);
  }

  // Step 6: extract plan #1
  console.log(`\n[6/7] Extracting plan #1...`);
  const topPlan = extractTopPlan(plansOutput);
  console.log(`  → ${topPlan.split("\n")[0].slice(0, 90)}`);
  console.log(`  → Plan length: ${topPlan.length} chars`);

  // Step 7: create build directory
  console.log(`\n[7/7] Creating build directory...`);
  const slug = (opp as any).title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
  const buildDir = resolve(__dirname, "..", "builds", `opp-${OPPORTUNITY_ID}-${slug}`);
  mkdirSync(buildDir, { recursive: true });

  writeFileSync(resolve(buildDir, "PLAN.md"), [
    `# ${(opp as any).title}`,
    ``,
    `> Opportunity #${OPPORTUNITY_ID} | Score: ${(opp as any).scoreTotal.toFixed(1)} | Community: ${(opp as any).community}`,
    `> Pain: ${(opp as any).painSummary}`,
    ``,
    `## Selected Idea`,
    ``,
    topIdea,
    ``,
    `## Implementation Plan`,
    ``,
    topPlan,
    ...(DESIGN_OUTPUT ? [`\n## Design\n\n${DESIGN_OUTPUT}`] : []),
    ...(TECH_STACK ? [`\n## Tech Stack\n\n${TECH_STACK}`] : []),
    ...(CUSTOM_PROMPT ? [`\n## Additional Instructions\n\n${CUSTOM_PROMPT}`] : []),
  ].join("\n"));

  writeFileSync(resolve(buildDir, "IDEAS.md"), ideasOutput);
  writeFileSync(resolve(buildDir, "ALL_PLANS.md"), plansOutput);

  console.log(`[BUILD_DIR:${buildDir}]`);
  console.log(`  → ${buildDir}`);
  console.log(`  → PLAN.md, IDEAS.md, ALL_PLANS.md written`);

  // Step 8: implement
  console.log(`\n${"═".repeat(56)}`);
  console.log(`IMPLEMENTATION - running claude in ${buildDir}`);
  console.log(`${"═".repeat(56)}`);
  console.log(`  → Running: claude --dangerously-skip-permissions`);
  console.log(`  → Expected time: 10-30 minutes\n`);

  const implPrompt = [
    `You are building a brand new SaaS product from scratch.`,
    ``,
    `Read PLAN.md in the current directory. It contains:`,
    `- The selected product idea`,
    `- The implementation plan`,
    ``,
    `Build the complete product as described. Requirements:`,
    `- Follow the tech stack from the plan exactly`,
    `- Build a production-ready V1`,
    `- Run pnpm install and make sure it compiles`,
    `- The app must start with: pnpm dev`,
    ``,
    `Start by reading PLAN.md, then implement the full product.`,
    ...(TECH_STACK ? [`\n### Tech Stack\n${TECH_STACK}`] : []),
    ...(DESIGN_OUTPUT ? [`\n### Design (from claude.ai/design)\nThe following design has been created. Implement it faithfully:\n\n${DESIGN_OUTPUT.slice(0, 8000)}`] : []),
    ...(CUSTOM_PROMPT ? [`\n### Additional Instructions\n${CUSTOM_PROMPT}`] : []),
  ].join("\n");

  const exitCode = await spawnAndStream(
    ["--dangerously-skip-permissions", "-p", implPrompt],
    buildDir
  );

  console.log(`\n${"═".repeat(56)}`);
  if (exitCode === 0) {
    console.log(`✓ Build complete → ${buildDir}`);
  } else {
    console.log(`! Implementation exited ${exitCode} → check ${buildDir}`);
  }
  console.log(`${"═".repeat(56)}`);

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
