import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dotenv from "dotenv";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import type { runChannel as RunChannelFn } from "./scripts/scrape-channel.js";
import type { runProcess as RunProcessFn } from "./scripts/process.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { tmpdir, homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

// ---------------------------------------------------------------------------
// Build registry - persists to disk so server restarts don't lose history
// ---------------------------------------------------------------------------

const REGISTRY_PATH = resolve(__dirname, ".build-registry.json");

function loadRegistry(): Map<string, LiveEntry> {
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf8");
    const entries: BuildEntry[] = JSON.parse(raw);
    // Any build that was mid-flight when the server died is now dead
    return new Map(entries.map((e) => [
      e.id,
      {
        ...e,
        status: (e.status === "running" || e.status === "dev:starting" || e.status === "dev:ready")
          ? "failed" as const
          : e.status,
        devUrl: undefined,
      } as LiveEntry,
    ]));
  } catch {
    return new Map();
  }
}

function persistRegistry() {
  try {
    // serializeBuild is defined below - this is only called after server is up
    const entries = [...buildRegistry.values()].map(({ _devChild, _buildChild, ...rest }) => rest);
    writeFileSync(REGISTRY_PATH, JSON.stringify(entries, null, 2));
  } catch { }
}

export type BuildStatus =
  | "running"
  | "dev:starting"
  | "dev:ready"
  | "done"
  | "failed"
  | "rate-limited";

export interface BuildEntry {
  id: string;
  opportunityId: number;
  projectId?: number;
  title: string;
  status: BuildStatus;
  logs: string[];
  startedAt: number;
  endedAt?: number;
  buildDir?: string;
  devUrl?: string;
  rateResetAt?: number;    // unix ms when limit resets + 3min buffer
  rateResetLabel?: string; // display string e.g. "11pm (Europe/London)"
}

interface LiveEntry extends BuildEntry {
  projectId?: number;
  _devChild?: ChildProcess;
  _buildChild?: ChildProcess;
}

const buildSubs = new Set<ServerResponse>();

// ── Scraper session registry ───────────────────────────────────────────────────
// Processes live here, not in the request. Tab switches don't kill them.
interface ScraperSession {
  logs: string[];
  done: boolean;
  exitCode: number | null;
  subscribers: Set<ServerResponse>;
  startedAt: number;
  stop: () => void;
}

const scraperSessions = new Map<string, ScraperSession>();

function scheduleSessionCleanup(key: string) {
  // Keep finished session logs around for 10 min so reconnecting clients can see results
  setTimeout(() => scraperSessions.delete(key), 10 * 60 * 1000);
}

function serializeBuild(e: LiveEntry): BuildEntry {
  const { _devChild, _buildChild, ...rest } = e;
  return rest;
}

// ── Channel Job Registry ───────────────────────────────────────────────────────
interface ChannelJob {
  id: string;
  channelId: number;
  channelType: string;
  projectId: number;
  projectName: string;
  status: "running" | "queued" | "completed" | "failed";
  queuePosition?: number; // only set when status === "queued"
  logs: string[];
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
  stop: () => void;
}

type SerializedJob = Omit<ChannelJob, "stop">;

type JobEvent =
  | { type: "snapshot"; jobs: SerializedJob[] }
  | { type: "created"; job: SerializedJob }
  | { type: "queued"; jobId: string; position: number }
  | { type: "started"; jobId: string }
  | { type: "log"; jobId: string; line: string }
  | { type: "ended"; jobId: string; status: "completed" | "failed"; exitCode: number; endedAt: number };

const channelJobs = new Map<string, ChannelJob>();
const jobSubs = new Set<ServerResponse>();

// ── Per-source queue ──────────────────────────────────────────────────────────
// At most 1 concurrent scraper per source type to avoid hammering APIs.
const sourceQueue = new Map<string, string[]>(); // source → ordered list of jobIds
const sourceRunning = new Map<string, boolean>(); // source → is a job currently running

function getSourceQueue(source: string): string[] {
  if (!sourceQueue.has(source)) sourceQueue.set(source, []);
  return sourceQueue.get(source)!;
}

function broadcastQueuePositions(source: string) {
  const queue = getSourceQueue(source);
  queue.forEach((jobId, idx) => {
    const job = channelJobs.get(jobId);
    if (job && job.status === "queued") {
      job.queuePosition = idx + 1;
      broadcastJobEvent({ type: "queued", jobId, position: idx + 1 });
    }
  });
}

// Attempt to start the next queued job for a source.
function drainSourceQueue(source: string) {
  if (sourceRunning.get(source)) return; // something already running for this source
  const queue = getSourceQueue(source);
  const nextId = queue.shift();
  if (!nextId) return;
  const job = channelJobs.get(nextId);
  if (!job) { drainSourceQueue(source); return; } // stale - skip
  sourceRunning.set(source, true);
  job.status = "running";
  job.queuePosition = undefined;
  broadcastJobEvent({ type: "started", jobId: nextId });
  broadcastQueuePositions(source); // update remaining positions
  spawnScraper(job);
}

function spawnScraper(job: ChannelJob) {
  const { id: jobId, channelId, channelType, projectId } = job;
  const broadcastLog = (line: string) => {
    job.logs.push(line);
    if (job.logs.length > 2000) job.logs.shift();
    broadcastJobEvent({ type: "log", jobId, line });
  };

  const finishJob = (code: number) => {
    if (job.status !== "running") return;
    const status = code === 0 ? "completed" : "failed";
    job.status = status;
    job.endedAt = Date.now();
    job.exitCode = code;
    broadcastJobEvent({ type: "ended", jobId, status, exitCode: code, endedAt: job.endedAt! });
    setTimeout(() => channelJobs.delete(jobId), 30 * 60 * 1000);
    // Free source slot and start next in queue
    sourceRunning.set(channelType, false);
    drainSourceQueue(channelType);
  };

  if (!projectScrapingJobs.has(projectId)) projectScrapingJobs.set(projectId, new Set());
  projectScrapingJobs.get(projectId)!.add(jobId);

  const child = spawn("npx", ["tsx", "scripts/scrape-channel.ts"], {
    env: { ...process.env, CHANNEL_ID: String(channelId), LOOKBACK_DAYS: String(30) },
    cwd: __dirname,
  });
  job.stop = () => {
    child.kill();
    // Also free the source slot so queue can proceed
    sourceRunning.set(channelType, false);
    drainSourceQueue(channelType);
  };

  child.stdout?.on("data", (c: Buffer) =>
    c.toString().split("\n").filter(Boolean).forEach(broadcastLog)
  );
  child.stderr?.on("data", (c: Buffer) =>
    c.toString().split("\n").filter(Boolean).forEach(broadcastLog)
  );
  child.on("close", (scraperCode) => {
    const projectJobs = projectScrapingJobs.get(projectId);
    if (projectJobs) projectJobs.delete(jobId);
    if (job.status !== "running") return;
    if ((scraperCode ?? 1) !== 0) {
      finishJob(scraperCode ?? 1);
      scheduleProjectProcess(projectId, broadcastLog);
      return;
    }
    const stillScraping = projectScrapingJobs.get(projectId);
    const remaining = stillScraping?.size ?? 0;
    if (remaining > 0) {
      broadcastLog(`> Scrape complete - ${remaining} channel(s) still running or queued.`);
    } else {
      broadcastLog("> Scrape complete - processing shortly…");
    }
    scheduleProjectProcess(projectId, broadcastLog);
    finishJob(0);
  });
  child.on("error", (err) => { broadcastLog(`[error: ${err.message}]`); finishJob(1); });
}

// Per-project coordinator: debounced processing - runs after each scraper finishes,
// waits for a quiet window in case more scrapers are still going.
const projectScrapingJobs = new Map<number, Set<string>>(); // projectId → Set<jobId>
const projectProcessing = new Map<number, AbortController>(); // projectId → running process
const projectProcessDebounce = new Map<number, ReturnType<typeof setTimeout>>(); // projectId → timer
const PROCESS_DEBOUNCE_MS = 8_000; // wait 8s after last scraper finishes before processing

function finishProjectJobs(projectId: number, exitCode: number) {
  projectProcessing.delete(projectId);
  const t = projectProcessDebounce.get(projectId);
  if (t) { clearTimeout(t); projectProcessDebounce.delete(projectId); }

  // Only finish jobs whose scrapers have actually completed.
  // Jobs still in projectScrapingJobs are mid-scrape and must stay "running".
  const stillScraping = projectScrapingJobs.get(projectId) ?? new Set<string>();

  for (const [jobId, job] of channelJobs) {
    if (job.projectId !== projectId || job.status !== "running") continue;
    if (stillScraping.has(jobId)) continue; // scraper still running - don't touch it
    const status = exitCode === 0 ? "completed" : "failed";
    job.status = status;
    job.endedAt = Date.now();
    job.exitCode = exitCode;
    broadcastJobEvent({ type: "ended", jobId, status, exitCode, endedAt: job.endedAt! });
    setTimeout(() => channelJobs.delete(jobId), 30 * 60 * 1000);
  }
}

function scheduleProjectProcess(projectId: number, broadcastLog: (line: string) => void) {
  // Cancel any pending timer and restart - debounces rapid completions
  const existing = projectProcessDebounce.get(projectId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    projectProcessDebounce.delete(projectId);
    runProjectProcess(projectId);
  }, PROCESS_DEBOUNCE_MS);

  projectProcessDebounce.set(projectId, timer);
}

function runProjectProcess(projectId: number) {
  if (projectProcessing.has(projectId)) {
    for (const [, job] of channelJobs) {
      if (job.projectId === projectId && job.status === "running") {
        broadcastJobEvent({ type: "log", jobId: job.id, line: "> processor already running - signals will be included" });
      }
    }
    return;
  }

  const ac = new AbortController();
  projectProcessing.set(projectId, ac);

  const procLine = (line: string) => {
    for (const [, job] of channelJobs) {
      if (job.projectId === projectId && job.status === "running") {
        job.logs.push(line);
        if (job.logs.length > 2000) job.logs.shift();
        broadcastJobEvent({ type: "log", jobId: job.id, line });
      }
    }
  };

  procLine("[phase:processing]");
  procLine("> Processing signals into opportunities…");

  // Allow stop buttons to abort processing
  for (const [, job] of channelJobs) {
    if (job.projectId === projectId && job.status === "running") {
      job.stop = () => ac.abort();
    }
  }

  import("./scripts/process.js").then(({ runProcess }) =>
    runProcess({ projectId, marketSlug: "saas", logger: procLine, signal: ac.signal })
  ).then(() => {
    finishProjectJobs(projectId, 0);
  }).catch((err: Error) => {
    if (ac.signal.aborted) {
      procLine("> Processing stopped.");
    } else {
      procLine(`[error: ${err.message}]`);
    }
    finishProjectJobs(projectId, 1);
  });
}

function serializeJob(job: ChannelJob): SerializedJob {
  const { stop: _, ...rest } = job;
  return rest;
}

function broadcastJobEvent(event: JobEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of [...jobSubs]) {
    try { res.write(data); } catch { jobSubs.delete(res); }
  }
}

// Initialized after serializeBuild is defined so loadRegistry can call it
const buildRegistry: Map<string, LiveEntry> = loadRegistry();

function broadcastBuild(entry: LiveEntry) {
  const data = `data: ${JSON.stringify({ build: serializeBuild(entry) })}\n\n`;
  for (const res of [...buildSubs]) {
    try { res.write(data); } catch { buildSubs.delete(res); }
  }
  persistRegistry();
}

function updateBuild(id: string, patch: Partial<BuildEntry>) {
  const e = buildRegistry.get(id);
  if (!e) return;
  Object.assign(e, patch);
  broadcastBuild(e);
}

function appendLog(id: string, line: string) {
  const e = buildRegistry.get(id);
  if (!e) return;
  e.logs.push(line);
  broadcastBuild(e);
}

function startDevServer(buildId: string, buildDir: string) {
  const e = buildRegistry.get(buildId);
  if (!e) return;

  appendLog(buildId, `> pnpm install in ${buildDir}...`);

  const install = spawn("pnpm", ["install"], { cwd: buildDir, env: process.env });

  install.stdout?.on("data", (c: Buffer) =>
    c.toString().split("\n").filter(Boolean).forEach((l) => appendLog(buildId, l))
  );
  install.stderr?.on("data", (c: Buffer) =>
    c.toString().split("\n").filter(Boolean).forEach((l) => appendLog(buildId, l))
  );

  install.on("close", (installCode) => {
    if (installCode !== 0) {
      appendLog(buildId, `[error] pnpm install failed (code ${installCode})`);
      updateBuild(buildId, { status: "failed" });
      return;
    }

    appendLog(buildId, `> Starting dev server (pnpm dev)...`);

    const devChild = spawn("pnpm", ["dev"], {
      cwd: buildDir,
      env: { ...process.env, NODE_ENV: "development" },
    });
    e._devChild = devChild;

    const detectUrl = (line: string) => {
      const m = line.match(/http:\/\/localhost:(\d+)/);
      if (m && e.status !== "dev:ready") {
        updateBuild(buildId, {
          status: "dev:ready",
          devUrl: `http://localhost:${m[1]}`,
        });
      }
    };

    devChild.stdout?.on("data", (c: Buffer) =>
      c.toString().split("\n").filter(Boolean).forEach((l) => {
        appendLog(buildId, l);
        detectUrl(l);
      })
    );
    devChild.stderr?.on("data", (c: Buffer) =>
      c.toString().split("\n").filter(Boolean).forEach((l) => {
        appendLog(buildId, l);
        detectUrl(l);
      })
    );

    devChild.on("close", (code) => {
      appendLog(buildId, `[dev server exited code ${code}]`);
      if (e.status === "dev:ready" || e.status === "dev:starting") {
        updateBuild(buildId, { devUrl: undefined, status: "done" });
      }
      e._devChild = undefined;
    });
  });
}

// ---------------------------------------------------------------------------
// Rate-limit detection + resume
// ---------------------------------------------------------------------------

function parseRateLimitLine(line: string): { label: string; resetAt: number } | null {
  const m = line.match(/hit your limit.*?resets?\s+([\w:]+(?:\s*[ap]m)?)\s*\(([^)]+)\)/i);
  if (!m) return null;
  const [, timeStr, tz] = m;
  const label = `${timeStr} (${tz})`;
  try {
    const tp = timeStr.trim().match(/^(\d+)(?::(\d+))?\s*(am|pm)$/i);
    if (!tp) return { label, resetAt: Date.now() + 65 * 60 * 1000 };
    let h = parseInt(tp[1]);
    const min = parseInt(tp[2] ?? "0");
    const isPm = tp[3].toLowerCase() === "pm";
    if (isPm && h !== 12) h += 12;
    if (!isPm && h === 12) h = 0;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const curH = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
    const curM = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    let diffMs = ((h * 60 + min) - (curH * 60 + curM)) * 60 * 1000;
    if (diffMs <= 0) diffMs += 24 * 60 * 60 * 1000;
    return { label, resetAt: Date.now() + diffMs + 3 * 60 * 1000 };
  } catch {
    return { label, resetAt: Date.now() + 65 * 60 * 1000 };
  }
}

const IMPL_PROMPT = [
  "You are building a brand new SaaS product from scratch.",
  "",
  "Read PLAN.md in the current directory. It contains:",
  "- The selected product idea",
  "- The implementation plan",
  "",
  "Build the complete product as described. Requirements:",
  "- Follow the tech stack from the plan exactly",
  "- Build a production-ready V1",
  "- Run pnpm install and make sure it compiles",
  "- The app must start with: pnpm dev",
  "",
  "Start by reading PLAN.md, then implement the full product.",
].join("\n");

function resumeBuild(buildId: string) {
  const e = buildRegistry.get(buildId);
  if (!e) return;

  updateBuild(buildId, { status: "running", rateResetAt: undefined, rateResetLabel: undefined });
  appendLog(buildId, `> Resuming after rate limit...`);

  let child: ChildProcess;

  if (e.buildDir) {
    // Rate limit hit during implementation - re-run just the claude step
    appendLog(buildId, `> Re-running: claude --dangerously-skip-permissions in ${e.buildDir}`);
    child = spawn("claude", ["--dangerously-skip-permissions", "-p", IMPL_PROMPT], {
      cwd: e.buildDir,
      env: process.env,
    });
  } else {
    // Rate limit hit during ideas/plans - restart the full pipeline
    appendLog(buildId, `> Restarting full build pipeline...`);
    child = spawn("npx", ["tsx", resolve(__dirname, "scripts/build-opportunity.ts")], {
      env: { ...process.env, OPPORTUNITY_ID: String(e.opportunityId) },
      cwd: __dirname,
    });
  }

  e._buildChild = child;

  const emit = (line: string) => {
    const bdm = line.match(/^\[BUILD_DIR:(.+)\]$/);
    if (bdm) { updateBuild(buildId, { buildDir: bdm[1] }); return; }
    appendLog(buildId, line);
    // detect another rate limit
    const rl = parseRateLimitLine(line);
    if (rl && e.status !== "rate-limited") {
      appendLog(buildId, `[Rate limited again - resets ${rl.label}]`);
      updateBuild(buildId, { status: "rate-limited", rateResetAt: rl.resetAt, rateResetLabel: rl.label });
    }
  };

  child.stdout?.on("data", (c: Buffer) => c.toString().split("\n").filter(Boolean).forEach(emit));
  child.stderr?.on("data", (c: Buffer) => c.toString().split("\n").filter(Boolean).forEach(emit));

  child.on("close", (code) => {
    e._buildChild = undefined;
    const current = buildRegistry.get(buildId);
    if (current?.status === "rate-limited") return;
    if (code === 0 && e.buildDir) {
      updateBuild(buildId, { status: "dev:starting", endedAt: Date.now() });
      appendLog(buildId, `> Build complete - starting dev server...`);
      startDevServer(buildId, e.buildDir);
    } else {
      updateBuild(buildId, { status: code === 0 ? "done" : "failed", endedAt: Date.now() });
    }
  });

  child.on("error", (err) => {
    appendLog(buildId, `[spawn error] ${err.message}`);
    updateBuild(buildId, { status: "failed", endedAt: Date.now() });
  });
}

// ---------------------------------------------------------------------------
// Script helpers
// ---------------------------------------------------------------------------

const PROCESS_SCRIPTS: Record<string, { args?: string[] }> = {
  process: {},
  reprocess: { args: ["--reprocess"] },
};

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseHeaders(res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

function sendEvent(res: ServerResponse, data: string) {
  try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { }
}

// ---------------------------------------------------------------------------
// Channel cron - fires every 15 min, enqueues all active channels for projects whose schedule is due
// ---------------------------------------------------------------------------

async function runChannelCronTick() {
  try {
    const { db } = await import("./src/db/index.js");
    const { channels, projects } = await import("./src/db/schema.js");
    const { and, eq, lte, ne, isNotNull } = await import("drizzle-orm");

    const now = new Date();

    // Find projects whose scan schedule is due
    const dueProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          ne(projects.scanSchedule, "manual"),
          isNotNull(projects.scanNextRunAt),
          lte(projects.scanNextRunAt, now),
        )
      );

    for (const project of dueProjects) {
      // Advance nextRunAt immediately to prevent double-triggering
      const intervalMs = project.scanSchedule === "daily"
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
      await db.update(projects)
        .set({ scanNextRunAt: new Date(Date.now() + intervalMs) })
        .where(eq(projects.id, project.id));

      // Get all active channels for this project
      const projectChannels = await db.select().from(channels)
        .where(and(eq(channels.projectId, project.id), eq(channels.status, "active")));

      const projectName = project.name ?? "Unknown";

      for (const ch of projectChannels) {

        // Enqueue the channel
        const channelType = ch.type;
        const jobId = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const queue = getSourceQueue(channelType);
        const isSourceBusy = (sourceRunning.get(channelType) ?? false) || queue.length > 0;

        const job: ChannelJob = {
          id: jobId,
          channelId: ch.id,
          channelType,
          projectId: ch.projectId,
          projectName: projectName ?? "Unknown",
          status: isSourceBusy ? "queued" : "running",
          queuePosition: isSourceBusy ? queue.length + 1 : undefined,
          logs: [],
          startedAt: Date.now(),
          stop: () => {
            const q = getSourceQueue(channelType);
            const idx = q.indexOf(jobId);
            if (idx !== -1) { q.splice(idx, 1); broadcastQueuePositions(channelType); }
            if (job.status === "queued") {
              job.status = "failed";
              job.endedAt = Date.now();
              broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt! });
            }
          },
        };

        channelJobs.set(jobId, job);
        broadcastJobEvent({ type: "created", job: serializeJob(job) });

        if (isSourceBusy) {
          queue.push(jobId);
        } else {
          sourceRunning.set(channelType, true);
          spawnScraper(job);
        }
      } // end channels loop
    }   // end dueProjects loop
  } catch (err) {
    console.error("[channel-cron] tick error:", err);
  }
}

function startChannelCron() {
  // Initial tick after 1 minute so the DB is warmed up
  setTimeout(() => {
    runChannelCronTick();
    setInterval(runChannelCronTick, 15 * 60 * 1000);
  }, 60_000);
}

// ---------------------------------------------------------------------------
// Deep scan - historical Reddit fetch + signal scoring + profile generation
// ---------------------------------------------------------------------------

async function runDeepScan(channelId: number, lookbackDays: number): Promise<void> {
  const { db } = await import("./src/db/index.js");
  const schema = await import("./src/db/schema.js");
  const { eq } = await import("drizzle-orm");

  const log = (msg: string) => console.log(`[deep-scan #${channelId}] ${msg}`);

  // Helper: set channel status
  async function setStatus(
    status: "running" | "done" | "failed" | "idle",
    progress?: number,
  ) {
    const patch: Record<string, unknown> = { deepScanStatus: status };
    if (progress !== undefined) patch.deepScanProgress = progress;
    if (status === "done") patch.lastDeepScanAt = new Date();
    await db.update(schema.channels).set(patch).where(eq(schema.channels.id, channelId));
  }

  try {
    const [channel] = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, channelId));

    if (!channel) { log("channel not found"); return; }
    if (channel.type !== "reddit") {
      log("deep scan only supported for reddit channels");
      await setStatus("failed");
      return;
    }

    const cfg = (channel.config ?? {}) as { subreddits?: string[] };
    const subreddits: string[] = cfg.subreddits ?? [];
    if (subreddits.length === 0) {
      log("no subreddits configured");
      await setStatus("failed");
      return;
    }

    await setStatus("running", 0);

    const afterUnix = Math.floor(Date.now() / 1000) - lookbackDays * 86400;
    const MAX_POSTS = 2000;
    const UA = "BurningDemand/1.0 deep-scan-research";

    // fetchWithRetry: handles 429 with a single 30s wait
    async function fetchWithRetry(url: string): Promise<Response> {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status !== 429) return r;
      log(`429 rate limit - waiting 30s…`);
      await new Promise((res) => setTimeout(res, 30_000));
      return fetch(url, { headers: { "User-Agent": UA } });
    }

    // Collect all posts across subreddits
    interface RawPost {
      id: string;
      title: string;
      selftext?: string;
      score: number;
      created_utc: number;
      permalink: string;
      subreddit: string;
      num_comments: number;
    }

    const allPosts: RawPost[] = [];

    for (let si = 0; si < subreddits.length; si++) {
      const sub = subreddits[si];
      log(`fetching r/${sub}…`);
      let after = afterUnix;
      let pageCount = 0;
      let subPostCount = 0;

      while (subPostCount < MAX_POSTS) {
        const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&after=${after}&limit=100&sort=score`;

        let resp: Response;
        try {
          resp = await fetchWithRetry(url);
        } catch (err) {
          log(`fetch error for r/${sub}: ${err}`);
          break;
        }

        if (!resp.ok) {
          log(`r/${sub} page ${pageCount + 1}: ${resp.status} - stopping`);
          break;
        }

        const json = await resp.json() as { data?: RawPost[] };
        const posts: RawPost[] = json.data ?? [];
        if (posts.length === 0) break;

        allPosts.push(...posts);
        subPostCount += posts.length;
        pageCount++;

        // Update progress: fetching phase is 0-50%
        const totalSubs = subreddits.length;
        const subFraction = (si + subPostCount / MAX_POSTS) / totalSubs;
        const progress = Math.min(49, Math.round(subFraction * 50));
        await setStatus("running", progress);

        // Arctic Shift pagination: use the created_utc of the last post as next `after`
        const lastPost = posts[posts.length - 1];
        if (!lastPost || lastPost.created_utc <= afterUnix) break;
        after = lastPost.created_utc;

        // Respectful delay
        await new Promise((r) => setTimeout(r, 1_000));
      }

      log(`r/${sub}: ${subPostCount} posts fetched`);
    }

    log(`total posts fetched: ${allPosts.length}`);

    // Sort by score, take top 100 for comment fetching
    const topPosts = [...allPosts]
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    // Fetch top comments for top 100 posts
    interface RawComment { body: string; score: number; author: string }
    const postComments = new Map<string, RawComment[]>();

    for (let pi = 0; pi < topPosts.length; pi++) {
      const post = topPosts[pi];
      try {
        const url = `https://arctic-shift.photon-reddit.com/api/comments/search?link_id=${post.id}&limit=10`;
        const resp = await fetchWithRetry(url);
        if (resp.ok) {
          const json = await resp.json() as { data?: RawComment[] };
          postComments.set(post.id, json.data ?? []);
        }
      } catch { /* skip */ }

      if (pi % 10 === 0) {
        const progress = 50 + Math.round((pi / topPosts.length) * 20);
        await setStatus("running", progress);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    log(`fetched comments for ${postComments.size} top posts`);

    // Score signals using AI and persist ones with score >= 5
    const apiKey = process.env.OPENROUTER_API_KEY;
    const cheapModel = process.env.OPENROUTER_CHEAP_MODEL ?? "google/gemini-flash-1-5-8b";
    const mainModel = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

    interface ScoredPost extends RawPost {
      authenticityScore: number;
      posterIntent: "buyer" | "seller" | "unclear";
      intentSignals: string[];
    }

    const scoredPosts: ScoredPost[] = [];

    if (apiKey && allPosts.length > 0) {
      // Score in batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < allPosts.length; i += BATCH_SIZE) {
        const batch = allPosts.slice(i, i + BATCH_SIZE);

        const batchText = batch.map((p, idx) =>
          `[${idx + 1}] Title: ${p.title}\nBody: ${(p.selftext ?? "").slice(0, 400)}\nScore: ${p.score}`
        ).join("\n\n---\n\n");

        const scoringPrompt = `You are evaluating Reddit posts for genuine buyer pain signals.

For each numbered post, return a JSON array with an object for each post:
{
  "authenticityScore": 1-10 (10 = genuine pain from a real user actively looking for a solution; 1 = promotional/research/bot),
  "posterIntent": "buyer" | "seller" | "unclear",
  "intentSignals": ["short reason 1", "short reason 2"]
}

Posts:
${batchText}

Return ONLY the JSON array, no markdown.`;

        try {
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://burningdemand.com",
            },
            body: JSON.stringify({
              model: cheapModel,
              messages: [{ role: "user", content: scoringPrompt }],
              temperature: 0.1,
              max_tokens: 800,
            }),
          });

          if (resp.ok) {
            const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
            const raw = data.choices?.[0]?.message?.content ?? "[]";
            const cleaned = raw.replace(/```json|```/g, "").trim();
            const scores = JSON.parse(cleaned) as Array<{
              authenticityScore: number;
              posterIntent: "buyer" | "seller" | "unclear";
              intentSignals: string[];
            }>;

            for (let j = 0; j < batch.length; j++) {
              const s = scores[j];
              if (!s) continue;
              scoredPosts.push({
                ...batch[j],
                authenticityScore: s.authenticityScore ?? 5,
                posterIntent: s.posterIntent ?? "unclear",
                intentSignals: s.intentSignals ?? [],
              });
            }
          }
        } catch (err) {
          log(`scoring batch ${i}–${i + BATCH_SIZE} error: ${err}`);
          // Push unscored fallback
          for (const p of batch) {
            scoredPosts.push({ ...p, authenticityScore: 5, posterIntent: "unclear", intentSignals: [] });
          }
        }

        // Progress: scoring phase 70-88%
        const progress = 70 + Math.round(((i + BATCH_SIZE) / allPosts.length) * 18);
        await setStatus("running", Math.min(88, progress));

        await new Promise((r) => setTimeout(r, 300));
      }
    } else {
      // No API key: use all posts with default score
      for (const p of allPosts) {
        scoredPosts.push({ ...p, authenticityScore: 5, posterIntent: "unclear", intentSignals: [] });
      }
    }

    // Persist signals with score >= 5 to DB
    let signalsSaved = 0;
    for (const post of scoredPosts) {
      if (post.authenticityScore < 5) continue;
      const rawText = [post.title, post.selftext ?? ""].join("\n\n").slice(0, 2000);
      if (!rawText || rawText.length < 40) continue;
      const url = `https://reddit.com${post.permalink}`;

      try {
        // Check if signal already exists
        const existing = await db
          .select({ id: schema.signals.id })
          .from(schema.signals)
          .where(eq(schema.signals.url, url))
          .limit(1);
        if (existing.length > 0) continue;

        await db.insert(schema.signals).values({
          source: "reddit",
          rawText,
          url,
          category: "discovery",
          projectId: null,
          channelId,
          scrapedAt: new Date(),
          market: "saas",
          postedAt: new Date(post.created_utc * 1000),
          authenticityScore: post.authenticityScore,
          posterIntent: post.posterIntent,
          intentSignals: post.intentSignals,
        });
        signalsSaved++;
      } catch { /* skip duplicate */ }
    }

    log(`signals saved: ${signalsSaved}`);
    await setStatus("running", 90);

    // Generate channel profile via AI
    if (apiKey) {
      // Take top 200 posts by score × authenticity for profile generation
      const profilePosts = [...scoredPosts]
        .sort((a, b) => (b.score * b.authenticityScore) - (a.score * a.authenticityScore))
        .slice(0, 200);

      for (const sub of subreddits) {
        const subPosts = profilePosts.filter((p) => p.subreddit.toLowerCase() === sub.toLowerCase());
        if (subPosts.length === 0) continue;

        const postSummaries = subPosts.slice(0, 80).map((p) => {
          const comments = postComments.get(p.id) ?? [];
          const topComment = comments.sort((a, b) => b.score - a.score)[0];
          return `Title: ${p.title} (score: ${p.score}, authenticity: ${p.authenticityScore})${p.selftext ? `\nBody: ${p.selftext.slice(0, 200)}` : ""
            }${topComment ? `\nTop comment: ${topComment.body.slice(0, 200)}` : ""}`;
        }).join("\n\n---\n\n");

        const profilePrompt = `You are analyzing Reddit community r/${sub} based on ${subPosts.length} posts and comments from the last ${lookbackDays} days.

Here are the top posts and their engagement:

${postSummaries}

Generate a detailed community profile as a JSON object with EXACTLY these fields:
{
  "communityCharacter": "1-2 sentences describing the community's culture, tone, and identity",
  "whoPostsHere": "description of typical poster: role, experience level, company size, pain sophistication",
  "opennessScore": <1-10, how welcoming this community is to product pitches and new tool mentions>,
  "painDensityScore": <1-10, how frequently genuine pain is expressed in posts>,
  "purchaseIntentScore": <1-10, how often posters show purchase intent or WTP signals>,
  "topPainThemes": [
    { "theme": "string", "frequency": <0-1 fraction of posts>, "avgAuthenticity": <1-10> }
  ],
  "whatGetsTraction": "specific post formats, title patterns, tones, and topics that get upvoted",
  "whatFails": "what gets ignored, downvoted, or triggers negative responses",
  "distributionPlaybook": "specific, actionable 3-5 step strategy for distributing your product here",
  "bestPostingTimes": "when to post for maximum engagement",
  "postLengthGuidance": "ideal post length and structure",
  "avoidList": ["specific thing to avoid 1", "specific thing to avoid 2"],
  "generatedAt": "${new Date().toISOString()}"
}

Return ONLY the JSON object, no markdown.`;

        try {
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://burningdemand.com",
            },
            body: JSON.stringify({
              model: mainModel,
              messages: [{ role: "user", content: profilePrompt }],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          });

          if (resp.ok) {
            const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
            const raw = data.choices?.[0]?.message?.content ?? "{}";
            const cleaned = raw.replace(/```json|```/g, "").trim();
            const profileData = JSON.parse(cleaned) as import("./src/db/schema.js").ChannelProfileData;

            await db.insert(schema.channelProfiles).values({
              channelId,
              subreddit: sub,
              profileJson: profileData,
              postsAnalyzed: subPosts.length,
              lookbackDays,
            });

            log(`profile generated for r/${sub}`);
          } else {
            log(`profile generation failed for r/${sub}: ${resp.status}`);
          }
        } catch (err) {
          log(`profile generation error for r/${sub}: ${err}`);
        }

        await new Promise((r) => setTimeout(r, 1_000));
      }
    }

    await setStatus("done", 100);
    log("deep scan complete");
  } catch (err) {
    console.error(`[deep-scan #${channelId}] fatal error:`, err);
    try {
      const { db } = await import("./src/db/index.js");
      const schema = await import("./src/db/schema.js");
      const { eq } = await import("drizzle-orm");
      await db.update(schema.channels)
        .set({ deepScanStatus: "failed" })
        .where(eq(schema.channels.id, channelId));
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Vite config
// ---------------------------------------------------------------------------

export default defineConfig({
  server: {
    port: 3000,
    watch: {
      ignored: (filePath: string) =>
        /\.(db|db-wal|db-shm|db-journal|db-wal2)$/.test(filePath) ||
        filePath.endsWith(".build-registry.json") ||
        filePath.includes("/.builds/") ||
        filePath.includes("/builds/"),
    },
  },
  plugins: [
    // ------------------------------------------------------------------
    // /api/build-opportunity  - starts build pipeline for one opportunity
    // ------------------------------------------------------------------
    {
      name: "api:build-opportunity",
      configureServer(server) {
        server.middlewares.use(
          "/api/build-opportunity",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const oppId = url.searchParams.get("id");
            const title = url.searchParams.get("title") || `Opportunity #${oppId}`;
            const projectId = parseInt(url.searchParams.get("projectId") || "0", 10) || undefined;
            const designOutput = url.searchParams.get("designOutput") || "";
            const techStack = url.searchParams.get("techStack") || "";
            const customPrompt = url.searchParams.get("customPrompt") || "";

            if (!oppId || isNaN(parseInt(oppId, 10))) {
              res.writeHead(400); res.end("Invalid id"); return;
            }

            // Create registry entry
            const buildId = randomUUID();
            const entry: LiveEntry = {
              id: buildId,
              opportunityId: parseInt(oppId, 10),
              projectId,
              title,
              status: "running",
              logs: [],
              startedAt: Date.now(),
            };
            buildRegistry.set(buildId, entry);
            broadcastBuild(entry);

            sseHeaders(res);
            // Send buildId so the caller can link to builds page
            res.write(`data: ${JSON.stringify(`[BUILD_ID:${buildId}]`)}\n\n`);

            let closed = false;
            req.on("close", () => { closed = true; });

            const emit = (line: string) => {
              const bdm = line.match(/^\[BUILD_DIR:(.+)\]$/);
              if (bdm) {
                updateBuild(buildId, { buildDir: bdm[1] });
                return;
              }

              appendLog(buildId, line);

              // Detect Claude rate limit
              const rl = parseRateLimitLine(line);
              if (rl && entry.status !== "rate-limited") {
                appendLog(buildId, `[Rate limited - resets ${rl.label}]`);
                updateBuild(buildId, { status: "rate-limited", rateResetAt: rl.resetAt, rateResetLabel: rl.label });
              }

              if (!closed) {
                try { res.write(`data: ${JSON.stringify(line)}\n\n`); } catch { }
              }
            };

            const child = spawn(
              "npx",
              ["tsx", resolve(__dirname, "scripts/build-opportunity.ts")],
              { env: { ...process.env, OPPORTUNITY_ID: oppId, DESIGN_OUTPUT: designOutput, TECH_STACK: techStack, CUSTOM_PROMPT: customPrompt }, cwd: __dirname }
            );
            entry._buildChild = child;

            child.stdout.on("data", (c: Buffer) =>
              c.toString().split("\n").filter(Boolean).forEach(emit)
            );
            child.stderr.on("data", (c: Buffer) =>
              c.toString().split("\n").filter(Boolean).forEach(emit)
            );

            child.on("close", (code) => {
              entry._buildChild = undefined;
              // Don't override if already rate-limited
              if (entry.status === "rate-limited") return;
              const success = code === 0;

              if (success && entry.buildDir) {
                updateBuild(buildId, {
                  status: "dev:starting",
                  endedAt: Date.now(),
                });
                appendLog(buildId, `> Build complete - starting dev server...`);
                startDevServer(buildId, entry.buildDir);
              } else {
                updateBuild(buildId, {
                  status: success ? "done" : "failed",
                  endedAt: Date.now(),
                });
              }

              if (!closed) {
                try {
                  res.write(`data: ${JSON.stringify(`[EXIT:${code ?? 1}]`)}\n\n`);
                  res.end();
                } catch { }
              }
            });

            child.on("error", (err) => {
              appendLog(buildId, `[spawn error] ${err.message}`);
              updateBuild(buildId, { status: "failed", endedAt: Date.now() });
              if (!closed) {
                try {
                  res.write(`data: ${JSON.stringify(`[EXIT:1]`)}\n\n`);
                  res.end();
                } catch { }
              }
            });
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/init-project  - initializes a project: creates GitHub repo,
    //                      copies base template, pnpm install, git push.
    //                      Streams progress as SSE.
    // ------------------------------------------------------------------
    {
      name: "api:init-project",
      configureServer(server) {
        server.middlewares.use(
          "/api/init-project",
          (req: IncomingMessage, res: ServerResponse) => {
            try {
              const url = new URL(req.url!, "http://localhost");
              // $id on the product route is a productId; accept either query key
              const productId = parseInt(url.searchParams.get("productId") || url.searchParams.get("projectId") || "0", 10);
              if (!productId) { res.writeHead(400); res.end("Missing productId"); return; }

              // Reuse build registry with opportunityId=0 to indicate v0 init
              const buildId = randomUUID();
              const entry: LiveEntry = {
                id: buildId,
                opportunityId: 0,
                projectId: productId,
                title: `v0 init - product #${productId}`,
                status: "running",
                logs: [],
                startedAt: Date.now(),
              };
              buildRegistry.set(buildId, entry);
              broadcastBuild(entry);

              sseHeaders(res);
              res.write(`data: ${JSON.stringify(`[BUILD_ID:${buildId}]`)}\n\n`);

              let closed = false;
              req.on("close", () => { closed = true; });

              const emit = (line: string) => {
                const bdm = line.match(/^\[BUILD_DIR:(.+)\]$/);
                if (bdm) { updateBuild(buildId, { buildDir: bdm[1] }); return; }
                appendLog(buildId, line);
                if (!closed) { try { res.write(`data: ${JSON.stringify(line)}\n\n`); } catch { } }
              };

              const child = spawn(
                "npx",
                ["tsx", resolve(__dirname, "scripts/init-project.ts")],
                { env: { ...process.env, PRODUCT_ID: String(productId) }, cwd: __dirname }
              );
              entry._buildChild = child;

              child.stdout.on("data", (c: Buffer) =>
                c.toString().split("\n").filter(Boolean).forEach(emit)
              );
              child.stderr.on("data", (c: Buffer) =>
                c.toString().split("\n").filter(Boolean).forEach(emit)
              );

              child.on("close", (code) => {
                entry._buildChild = undefined;
                updateBuild(buildId, { status: code === 0 ? "done" : "failed", endedAt: Date.now() });
                if (!closed) {
                  try { res.write(`data: ${JSON.stringify(`[EXIT:${code ?? 1}]`)}\n\n`); res.end(); } catch { }
                }
              });

              child.on("error", (err) => {
                appendLog(buildId, `[spawn error] ${err.message}`);
                updateBuild(buildId, { status: "failed", endedAt: Date.now() });
                if (!closed) { try { res.write(`data: ${JSON.stringify(`[EXIT:1]`)}\n\n`); res.end(); } catch { } }
              });
            } catch (err: any) {
              console.error("[api:init-project] handler error:", err);
              if (!res.headersSent) {
                res.writeHead(500); res.end(String(err?.message ?? err));
              } else {
                try { res.write(`data: ${JSON.stringify(`✗ Server error: ${err?.message}`)}\n\n`); res.write(`data: ${JSON.stringify("[EXIT:1]")}\n\n`); res.end(); } catch { }
              }
            }
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds-list  - returns snapshot of all builds as JSON
    // ------------------------------------------------------------------
    {
      name: "api:builds-list",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds-list",
          (_req: IncomingMessage, res: ServerResponse) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify(
                [...buildRegistry.values()].map(serializeBuild).reverse()
              )
            );
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/generate-prototype  - generates full HTML product prototype via Claude CLI
    // /api/stop-prototype      - kills the running prototype generation
    // ------------------------------------------------------------------
    (() => {
      let protoChild: ReturnType<typeof spawn> | null = null;

      return [
        {
          name: "api:generate-prototype",
          configureServer(server: any) {
            server.middlewares.use(
              "/api/generate-prototype",
              (req: IncomingMessage, res: ServerResponse) => {
                if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
                let body = "";
                req.on("data", (c: Buffer) => { body += c.toString(); });
                req.on("end", () => {
                  try {
                    const { customPrompt, projectId } = JSON.parse(body) as { customPrompt: string; projectId: number };
                    const promptFile = `${tmpdir()}/bd-proto-prompt-${projectId}.txt`;
                    const outFile = `${tmpdir()}/bd-prototype-${projectId}.html`;
                    const scriptFile = `${tmpdir()}/bd-proto-run-${projectId}.sh`;
                    const claudeBin = process.env.CLAUDE_BIN || "/Users/vladpalos/.local/bin/claude";
                    writeFileSync(promptFile, customPrompt, "utf-8");
                    writeFileSync(scriptFile, [
                      `#!/bin/bash`,
                      `echo "Building prototype…"`,
                      `${claudeBin} --dangerously-skip-permissions -p "$(cat ${promptFile})" > ${outFile}`,
                      `echo ""`,
                      `echo "✓ Saved to ${outFile}"`,
                    ].join("\n"), "utf-8");
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ scriptFile, outFile }));
                  } catch (e: any) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: e?.message ?? "Failed" }));
                  }
                });
              }
            );
          },
        },
        {
          name: "api:stop-prototype",
          configureServer(server: any) {
            server.middlewares.use(
              "/api/stop-prototype",
              (_req: IncomingMessage, res: ServerResponse) => {
                if (protoChild) { try { protoChild.kill(); } catch { } protoChild = null; }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
              }
            );
          },
        },
        {
          name: "api:load-prototype",
          configureServer(server: any) {
            server.middlewares.use(
              "/api/load-prototype",
              (req: IncomingMessage, res: ServerResponse) => {
                const url = new URL(req.url!, `http://localhost`);
                const outFile = url.searchParams.get("file") ?? "";
                try {
                  const html = readFileSync(outFile, "utf-8").trim()
                    .replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\s*$/, "").trim();
                  if (html.includes("<!DOCTYPE") || html.startsWith("<html")) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ html }));
                  } else {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: `File doesn't look like HTML: ${html.slice(0, 200)}` }));
                  }
                } catch (e: any) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: `File not found: ${outFile}` }));
                }
              }
            );
          },
        },
        {
          name: "api:open-warp",
          configureServer(server: any) {
            server.middlewares.use(
              "/api/open-warp",
              (_req: IncomingMessage, res: ServerResponse) => {
                spawn("open", ["-a", "Warp", __dirname], { detached: true }).unref();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
              }
            );
          },
        },
        {
          name: "api:test-claude",
          configureServer(server: any) {
            server.middlewares.use(
              "/api/test-claude",
              (_req: IncomingMessage, res: ServerResponse) => {
                const claudeBin = process.env.CLAUDE_BIN || "/Users/vladpalos/.local/bin/claude";
                const lines: string[] = [];
                const child = spawn(claudeBin, ["--version"], {
                  env: {
                    ...process.env,
                    HOME: process.env.HOME || homedir(),
                    PATH: `/Users/vladpalos/.local/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}`,
                  },
                  stdio: ["ignore", "pipe", "pipe"],
                });
                child.stdout.on("data", (c: Buffer) => lines.push(...c.toString().split("\n").filter(Boolean)));
                child.stderr.on("data", (c: Buffer) => lines.push(...c.toString().split("\n").filter(Boolean)));
                child.on("close", (code) => {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ bin: claudeBin, code, output: lines }));
                });
                child.on("error", (err: Error) => {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ bin: claudeBin, error: err.message }));
                });
              }
            );
          },
        },
      ];
    })(),

    // ------------------------------------------------------------------
    // /api/extract-design-tokens  - strips HTML to design system tokens
    // ------------------------------------------------------------------
    {
      name: "api:extract-design-tokens",
      configureServer(server) {
        server.middlewares.use(
          "/api/extract-design-tokens",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const { html } = JSON.parse(body) as { html: string };
                const OpenAI = (await import("openai")).default;
                const client = new OpenAI({
                  apiKey: process.env.OPENROUTER_API_KEY,
                  baseURL: "https://openrouter.ai/api/v1",
                  defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
                });
                const result = await client.chat.completions.create({
                  model: "google/gemini-3.1-flash-lite-preview",
                  max_tokens: 1200,
                  messages: [{
                    role: "user",
                    content: `Extract only the design system from this HTML file. Return a concise text description of:
- Color palette (background, foreground, accent, border, muted - exact hex values)
- Typography (font family, size scale, weight choices)
- Border radius style (sharp/subtle/rounded - exact px or rem values)
- Spacing scale
- Shadow / elevation style
- Button style (flat/outlined/filled, border-radius, padding)
- Any distinctive UI patterns (glassmorphism, neumorphism, minimal, bold, etc.)

Format as clear concise guidelines, NOT as code. Strip all content, layout, and dummy data. Max 300 words.

HTML:
${html.slice(0, 8000)}`,
                  }],
                });
                const tokens = result.choices[0].message.content ?? "";
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ tokens }));
              } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: e?.message ?? "Failed" }));
              }
            });
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds-stream  - SSE feed of all build events
    // ------------------------------------------------------------------
    {
      name: "api:builds-stream",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds-stream",
          (req: IncomingMessage, res: ServerResponse) => {
            sseHeaders(res);

            // Send current snapshot so client starts fully hydrated
            for (const e of buildRegistry.values()) {
              try {
                res.write(
                  `data: ${JSON.stringify({ build: serializeBuild(e) })}\n\n`
                );
              } catch { return; }
            }

            buildSubs.add(res);
            req.on("close", () => buildSubs.delete(res));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds/stop-dev  - kill the dev server for a build
    // ------------------------------------------------------------------
    {
      name: "api:builds-stop-dev",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds/stop-dev",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const buildId = url.searchParams.get("buildId");
            const entry = buildId ? buildRegistry.get(buildId) : undefined;

            if (!entry) {
              res.writeHead(404); res.end("Not found"); return;
            }

            if (entry._devChild) {
              entry._devChild.kill();
              entry._devChild = undefined;
            }
            updateBuild(buildId!, { status: "done", devUrl: undefined });
            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds/start-dev  - (re)start dev server for a completed build
    // ------------------------------------------------------------------
    {
      name: "api:builds-start-dev",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds/start-dev",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const buildId = url.searchParams.get("buildId");
            const entry = buildId ? buildRegistry.get(buildId) : undefined;

            if (!entry || !entry.buildDir) {
              res.writeHead(400); res.end("No buildDir"); return;
            }

            updateBuild(buildId!, { status: "dev:starting", devUrl: undefined });
            startDevServer(buildId!, entry.buildDir);
            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds/resume  - resume a rate-limited build
    // ------------------------------------------------------------------
    {
      name: "api:builds-resume",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds/resume",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const buildId = url.searchParams.get("buildId");
            const entry = buildId ? buildRegistry.get(buildId) : undefined;

            if (!entry) {
              res.writeHead(404); res.end("Not found"); return;
            }

            resumeBuild(buildId!);
            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds/delete  - remove a build from the registry
    // ------------------------------------------------------------------
    {
      name: "api:builds-delete",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds/delete",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const buildId = url.searchParams.get("buildId");
            const entry = buildId ? buildRegistry.get(buildId) : undefined;

            if (!entry) {
              res.writeHead(404); res.end("Not found"); return;
            }

            if (entry._devChild) entry._devChild.kill();
            if (entry._buildChild) entry._buildChild.kill();

            buildRegistry.delete(buildId!);

            const data = `data: ${JSON.stringify({ deleted: buildId })}\n\n`;
            for (const sub of [...buildSubs]) {
              try { sub.write(data); } catch { buildSubs.delete(sub); }
            }
            persistRegistry();

            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/builds/rename  - rename a build (POST body: { buildId, title })
    // ------------------------------------------------------------------
    {
      name: "api:builds-rename",
      configureServer(server) {
        server.middlewares.use(
          "/api/builds/rename",
          async (req: IncomingMessage, res: ServerResponse) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            let payload: { buildId: string; title: string };
            try { payload = JSON.parse(body); } catch { res.writeHead(400); res.end("Bad JSON"); return; }

            const { buildId, title } = payload;
            if (!buildId || !title?.trim()) {
              res.writeHead(400); res.end("buildId and title required"); return;
            }

            if (!buildRegistry.has(buildId)) {
              res.writeHead(404); res.end("Not found"); return;
            }

            updateBuild(buildId, { title: title.trim() });
            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/run-script  - existing scraper / process runner
    // ------------------------------------------------------------------
    {
      name: "api:run-script",
      configureServer(server) {
        server.middlewares.use(
          "/api/run-script",
          async (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const script = url.searchParams.get("script");
            const provider = url.searchParams.get("provider") || "openrouter";

            // Read optional POST body for market
            let marketSlug: string | undefined;
            if (req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              try {
                const parsed = JSON.parse(body);
                marketSlug = parsed.market ?? process.env.MARKET_SLUG;
              } catch {
                marketSlug = process.env.MARKET_SLUG;
              }
            } else {
              marketSlug = url.searchParams.get("market") ?? process.env.MARKET_SLUG ?? undefined;
            }

            if (!script || !PROCESS_SCRIPTS[script]) {
              res.writeHead(400); res.end("Invalid script"); return;
            }

            sseHeaders(res);

            // ── Reconnect: join existing live session (only if still running) ──
            const existing = scraperSessions.get(script);
            if (existing && !existing.done) {
              sendEvent(res, "[RECONNECTED]");
              for (const log of existing.logs) sendEvent(res, log);
              existing.subscribers.add(res);
              req.on("close", () => existing.subscribers.delete(res));
              return;
            }
            // If session is done (finished or errored), clear it and start fresh
            if (existing?.done) scraperSessions.delete(script);

            // ── New session ────────────────────────────────────────────
            const session: ScraperSession = {
              logs: [],
              done: false,
              exitCode: null,
              subscribers: new Set([res]),
              startedAt: Date.now(),
              stop: () => { },
            };
            scraperSessions.set(script, session);
            req.on("close", () => session.subscribers.delete(res));

            const broadcast = (line: string) => {
              session.logs.push(line);
              if (session.logs.length > 2000) session.logs.shift();
              for (const sub of session.subscribers) sendEvent(sub, line);
            };

            const finishSession = (code: number) => {
              session.done = true;
              session.exitCode = code;
              broadcast(`[EXIT:${code}]`);
              for (const sub of session.subscribers) { try { sub.end(); } catch { } }
              session.subscribers.clear();
              scheduleSessionCleanup(script);
            };

            const { args: extraArgs = [] } = PROCESS_SCRIPTS[script];
            const ac = new AbortController();
            session.stop = () => ac.abort();

            import("./scripts/process.js").then(({ runProcess }) =>
              runProcess({
                reprocess: extraArgs.includes("--reprocess"),
                marketSlug,
                logger: broadcast,
                signal: ac.signal,
              })
            ).then(() => {
              finishSession(0);
            }).catch((err: Error) => {
              if (!ac.signal.aborted) broadcast(`[error: ${err.message}]`);
              finishSession(1);
            });
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/channel-jobs  - create / list channel scrape jobs
    // ------------------------------------------------------------------
    {
      name: "api:channel-jobs",
      configureServer(server) {
        server.middlewares.use(
          "/api/channel-jobs",
          async (req: IncomingMessage, res: ServerResponse) => {
            // ── SSE stream sub-route (/api/channel-jobs/stream)
            if (req.url?.startsWith("/stream")) {
              sseHeaders(res);
              res.write(`data: ${JSON.stringify({ type: "snapshot", jobs: [...channelJobs.values()].map(serializeJob) })}\n\n`);
              jobSubs.add(res);
              req.on("close", () => jobSubs.delete(res));
              return;
            }

            // ── POST /api/channel-jobs/stop/:jobId - kill a specific job
            if (req.url?.startsWith("/stop/") && req.method === "POST") {
              const jobId = req.url.slice("/stop/".length);
              const job = channelJobs.get(jobId);
              if (!job) { res.writeHead(404); res.end(JSON.stringify({ error: "Not found" })); return; }
              job.stop?.(); // signal abort
              if (job.status === "running") {
                job.status = "failed";
                job.endedAt = Date.now();
                job.exitCode = -1;
                broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt });
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            // ── POST /api/channel-jobs/stop-all - kill all running jobs for a project
            if (req.url?.startsWith("/stop-all") && req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              const { projectId } = body ? JSON.parse(body) : {} as any;
              for (const [jobId, job] of channelJobs) {
                if (job.status === "running" && (!projectId || job.projectId === projectId)) {
                  job.stop?.();
                  job.status = "failed";
                  job.endedAt = Date.now();
                  job.exitCode = -1;
                  broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt });
                }
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            // ── GET: list all jobs
            if (req.method === "GET") {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify([...channelJobs.values()].map(serializeJob)));
              return;
            }

            // ── POST: enqueue a job
            if (req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              let payload: { channelId: number; channelType: string; projectId: number; projectName: string; lookbackDays?: number };
              try { payload = JSON.parse(body); }
              catch { res.writeHead(400); res.end("Invalid JSON"); return; }

              const { channelId, channelType, projectId, projectName } = payload;
              if (!channelId) { res.writeHead(400); res.end("channelId required"); return; }

              // Skip if this channel is already running or queued
              for (const job of channelJobs.values()) {
                if (job.channelId === channelId && (job.status === "running" || job.status === "queued")) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ jobId: job.id, skipped: true }));
                  return;
                }
              }

              const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const queue = getSourceQueue(channelType);
              const isSourceBusy = sourceRunning.get(channelType) ?? false;
              const queuePos = isSourceBusy ? queue.length + 1 : 0;

              const job: ChannelJob = {
                id: jobId, channelId, channelType, projectId, projectName,
                status: isSourceBusy ? "queued" : "running",
                queuePosition: queuePos > 0 ? queuePos : undefined,
                logs: [], startedAt: Date.now(),
                stop: () => {
                  // If queued, just remove from queue
                  const q = getSourceQueue(channelType);
                  const idx = q.indexOf(jobId);
                  if (idx !== -1) {
                    q.splice(idx, 1);
                    broadcastQueuePositions(channelType);
                  }
                  if (job.status === "queued") {
                    job.status = "failed";
                    job.endedAt = Date.now();
                    broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt! });
                  }
                },
              };
              channelJobs.set(jobId, job);
              broadcastJobEvent({ type: "created", job: serializeJob(job) });

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ jobId, queued: isSourceBusy, position: queuePos }));

              if (isSourceBusy) {
                queue.push(jobId);
              } else {
                sourceRunning.set(channelType, true);
                spawnScraper(job);
              }
              return;
            }

            res.writeHead(405); res.end("Method not allowed");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/run-all-channels  - enqueue all active channels across all projects
    // ------------------------------------------------------------------
    {
      name: "api:run-all-channels",
      configureServer(server) {
        server.middlewares.use(
          "/api/run-all-channels",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
            let body = ""; for await (const chunk of req) body += chunk;
            const { projectId: filterProjectId } = body ? JSON.parse(body) as { projectId?: number } : {};

            const { db, channels, projects } = await import("./src/db/index.js");
            const { eq, and } = await import("drizzle-orm");

            const where = filterProjectId != null
              ? and(eq(channels.status, "active"), eq(channels.projectId, filterProjectId))
              : eq(channels.status, "active");

            const rows = await db
              .select({ ch: channels, projectName: projects.name })
              .from(channels)
              .innerJoin(projects, eq(projects.id, channels.projectId))
              .where(where);

            let queued = 0, skipped = 0;
            for (const { ch, projectName } of rows) {
              // Skip if already running or queued
              let alreadyActive = false;
              for (const job of channelJobs.values()) {
                if (job.channelId === ch.id && (job.status === "running" || job.status === "queued")) {
                  alreadyActive = true; break;
                }
              }
              if (alreadyActive) { skipped++; continue; }

              const channelType = ch.type;
              const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const queue = getSourceQueue(channelType);
              const isSourceBusy = (sourceRunning.get(channelType) ?? false) || queue.length > 0;
              const queuePos = isSourceBusy ? queue.length + 1 : 0;

              const job: ChannelJob = {
                id: jobId, channelId: ch.id, channelType,
                projectId: ch.projectId!, projectName: projectName ?? "Unknown",
                status: isSourceBusy ? "queued" : "running",
                queuePosition: queuePos > 0 ? queuePos : undefined,
                logs: [], startedAt: Date.now(),
                stop: () => {
                  const q = getSourceQueue(channelType);
                  const idx = q.indexOf(jobId);
                  if (idx !== -1) { q.splice(idx, 1); broadcastQueuePositions(channelType); }
                  if (job.status === "queued") {
                    job.status = "failed"; job.endedAt = Date.now();
                    broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt! });
                  }
                },
              };
              channelJobs.set(jobId, job);
              broadcastJobEvent({ type: "created", job: serializeJob(job) });

              if (isSourceBusy) {
                queue.push(jobId);
              } else {
                sourceRunning.set(channelType, true);
                spawnScraper(job);
              }
              queued++;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ queued, skipped, total: rows.length }));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/run-all-opportunities  - run process.ts for all projects
    // ------------------------------------------------------------------
    {
      name: "api:run-all-opportunities",
      configureServer(server) {
        server.middlewares.use(
          "/api/run-all-opportunities",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
            const { db, projects } = await import("./src/db/index.js");
            const rows = await db.select({ id: projects.id }).from(projects);

            for (const { id } of rows) {
              if (!projectProcessing.has(id)) {
                runProjectProcess(id);
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ started: rows.length }));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/scraper-status  - which scrapers are currently running
    // ------------------------------------------------------------------
    {
      name: "api:scraper-status",
      configureServer(server) {
        server.middlewares.use(
          "/api/scraper-status",
          (_req: IncomingMessage, res: ServerResponse) => {
            const running = [...scraperSessions.entries()]
              .filter(([, s]) => !s.done)
              .map(([key]) => key);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(running));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/stop-all  - kill every running/queued job across all sources
    // ------------------------------------------------------------------
    {
      name: "api:stop-all",
      configureServer(server) {
        server.middlewares.use(
          "/api/stop-all",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end(); return; }

            // 1. Clear all source queues so no new jobs start
            for (const [source] of sourceQueue) sourceQueue.set(source, []);
            for (const [source] of sourceRunning) sourceRunning.set(source, false);

            // 2. Stop all running/queued channel jobs
            for (const [jobId, job] of channelJobs) {
              if (job.status === "running" || job.status === "queued") {
                job.stop?.();
                job.status = "failed";
                job.endedAt = Date.now();
                job.exitCode = -1;
                broadcastJobEvent({ type: "ended", jobId, status: "failed", exitCode: -1, endedAt: job.endedAt });
              }
            }

            // 3. Stop all running build jobs
            for (const [buildId, entry] of buildRegistry) {
              if ((entry as any).status === "running") {
                if ((entry as any)._buildChild) { (entry as any)._buildChild.kill(); (entry as any)._buildChild = undefined; }
                updateBuild(buildId, { status: "done" });
              }
            }

            // 4. Stop all active scraper sessions
            for (const [, session] of scraperSessions) {
              if (!session.done) session.stop();
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/stop-script  - explicitly kill a running scraper session
    // ------------------------------------------------------------------
    {
      name: "api:stop-script",
      configureServer(server) {
        server.middlewares.use(
          "/api/stop-script",
          (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const script = url.searchParams.get("script");
            const session = script ? scraperSessions.get(script) : undefined;
            if (session && !session.done) {
              session.stop();
            }
            res.writeHead(200); res.end("ok");
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/analyze-community - deep-scan a discovered community
    // Accepts POST { discoveredCommunityId }
    // Fetches posts via Arctic Shift, generates community profile + CFF score.
    // ------------------------------------------------------------------
    {
      name: "api:analyze-community",
      configureServer(server) {
        server.middlewares.use(
          "/api/analyze-community",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }

            const body = await new Promise<string>((resolve) => {
              let d = "";
              req.on("data", (c: Buffer) => d += c.toString());
              req.on("end", () => resolve(d));
            });

            let discoveredCommunityId: number;
            try { discoveredCommunityId = JSON.parse(body).discoveredCommunityId; }
            catch { res.writeHead(400); res.end("Bad JSON"); return; }

            // Respond immediately with 202
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));

            // Background processing
            (async () => {
              const log = (msg: string) => console.log(`[analyze-community #${discoveredCommunityId}]`, msg);
              try {
                const { db } = await import("./src/db/index.js");
                const schema = await import("./src/db/schema.js");
                const { eq, desc } = await import("drizzle-orm");

                const [community] = await db.select().from(schema.discoveredCommunities)
                  .where(eq(schema.discoveredCommunities.id, discoveredCommunityId));
                if (!community) { log("community not found"); return; }

                const [profileRow] = await db.select().from(schema.discoveryProfiles)
                  .orderBy(desc(schema.discoveryProfiles.createdAt)).limit(1);
                if (!profileRow) { log("no discovery profile found"); return; }

                const subreddit = community.subreddit;
                const lookbackDays = profileRow.lookbackDays ?? 60;
                const founderPrompt = profileRow.prompt;
                const extractedKeywords: string[] = profileRow.extractedKeywords ?? [];

                const lookbackDaysAgo = new Date(Date.now() - lookbackDays * 86400 * 1000).toISOString();
                const UA = "Mozilla/5.0 BurningDemand/1.0";

                // Fetch posts from Arctic Shift
                log(`fetching posts for r/${subreddit}…`);
                interface ArcticPost {
                  name: string;
                  title: string;
                  selftext?: string;
                  score: number;
                  num_comments: number;
                  permalink?: string;
                }
                let rawPosts: ArcticPost[] = [];
                try {
                  const postsUrl = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(subreddit)}&after=${lookbackDaysAgo}&limit=500&sort=top`;
                  const postsRes = await fetch(postsUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
                  if (postsRes.ok) {
                    const postsJson = await postsRes.json() as { data?: ArcticPost[] };
                    rawPosts = postsJson.data ?? [];
                  }
                } catch (err) {
                  log(`posts fetch error: ${err}`);
                }
                log(`fetched ${rawPosts.length} posts`);

                // Fetch top comments for posts with score > 5 (max 20 posts)
                interface ArcticComment { body: string; score: number }
                const highScorePosts = rawPosts.filter(p => p.score > 5).slice(0, 20);
                const commentMap = new Map<string, string[]>();
                for (const post of highScorePosts) {
                  try {
                    const commentsUrl = `https://arctic-shift.photon-reddit.com/api/comments/search?link_id=${encodeURIComponent(post.name)}&limit=10&sort=top`;
                    const commentsRes = await fetch(commentsUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
                    if (commentsRes.ok) {
                      const commentsJson = await commentsRes.json() as { data?: ArcticComment[] };
                      commentMap.set(post.name, (commentsJson.data ?? []).map((c: ArcticComment) => c.body?.slice(0, 300) ?? ""));
                    }
                  } catch { /* skip */ }
                  await new Promise(r => setTimeout(r, 200));
                }

                const posts = rawPosts.map(p => ({
                  title: p.title ?? "",
                  selftext: (p.selftext ?? "").slice(0, 500),
                  score: p.score ?? 0,
                  num_comments: p.num_comments ?? 0,
                  topComments: commentMap.get(p.name) ?? [],
                }));

                const { analyzeDiscoveredCommunityPosts, computeCFF } = await import("./src/lib/ai.js");

                log("generating community profile…");
                const profile = await analyzeDiscoveredCommunityPosts({ subreddit, posts, founderPrompt });

                log("computing CFF score…");
                const cff = await computeCFF({ founderPrompt, extractedKeywords, subreddit, profile });

                await db.update(schema.discoveredCommunities).set({
                  profileJson: profile,
                  cffJson: cff,
                  scanStatus: "done",
                  postsAnalyzed: posts.length,
                  lastScannedAt: new Date(),
                  updatedAt: new Date(),
                }).where(eq(schema.discoveredCommunities.id, discoveredCommunityId));

                log("done");
              } catch (err) {
                console.error(`[analyze-community #${discoveredCommunityId}] fatal error:`, err);
                try {
                  const { db } = await import("./src/db/index.js");
                  const schema = await import("./src/db/schema.js");
                  const { eq } = await import("drizzle-orm");
                  await db.update(schema.discoveredCommunities)
                    .set({ scanStatus: "failed", updatedAt: new Date() })
                    .where(eq(schema.discoveredCommunities.id, discoveredCommunityId));
                } catch { /* ignore */ }
              }
            })();
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/deep-scan  - long-running channel profile generation
    // Accepts POST { channelId, lookbackDays? }
    // Fetches posts via Arctic Shift, scores signals, generates AI profile.
    // ------------------------------------------------------------------
    {
      name: "api:deep-scan",
      configureServer(server) {
        server.middlewares.use(
          "/api/deep-scan",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }

            let body = "";
            for await (const chunk of req) body += chunk;
            let payload: { channelId: number; lookbackDays?: number };
            try { payload = JSON.parse(body); } catch { res.writeHead(400); res.end("Bad JSON"); return; }

            // Respond immediately - work runs asynchronously
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));

            // Run in background (no await)
            runDeepScan(payload.channelId, payload.lookbackDays ?? 365).catch((err) => {
              console.error("[deep-scan] unhandled error:", err);
            });
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-search  - run DataForSEO keyword discovery
    // ------------------------------------------------------------------
    {
      name: "api:seo-search",
      configureServer(server) {
        server.middlewares.use(
          "/api/seo-search",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }

            let body = "";
            for await (const chunk of req) body += chunk;
            let payload: { keyword: string; maxVolume?: number; minCpc?: number; market?: string; forceRefresh?: boolean; projectId?: number; opportunityId?: number; purpose?: "discovery" | "distribution" };
            try { payload = JSON.parse(body); } catch { res.writeHead(400); res.end("Bad JSON"); return; }

            const { keyword, maxVolume = 1000, minCpc = 1.0, market: marketSlug = process.env.MARKET_SLUG ?? "saas", forceRefresh = false, projectId, opportunityId, purpose = "discovery" } = payload;
            if (!keyword?.trim()) { res.writeHead(400); res.end("keyword required"); return; }

            const { db: database } = await import("./src/db/index.js");
            const schema = await import("./src/db/schema.js");
            const { eq, and, desc, isNull } = await import("drizzle-orm");

            // ── Cache lookup: same keyword + market + project → skip the API ─
            const cacheConditions = projectId != null
              ? and(eq(schema.seoRuns.seedKeyword, keyword.trim()), eq(schema.seoRuns.market, marketSlug), eq(schema.seoRuns.projectId, projectId))
              : and(eq(schema.seoRuns.seedKeyword, keyword.trim()), eq(schema.seoRuns.market, marketSlug), isNull(schema.seoRuns.projectId));
            const [cachedRun] = !forceRefresh ? await database
              .select()
              .from(schema.seoRuns)
              .where(cacheConditions)
              .orderBy(desc(schema.seoRuns.createdAt))
              .limit(1) : [];

            if (cachedRun) {
              const cachedKws = await database
                .select()
                .from(schema.keywordOpportunities)
                .where(eq(schema.keywordOpportunities.runId, cachedRun.id))
                .orderBy(desc(schema.keywordOpportunities.opportunityScore));

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                runId: cachedRun.id,
                total: cachedKws.length,
                rawTotal: cachedKws.length,
                cost: 0,
                cached: true,
                cachedAt: cachedRun.createdAt,
                keywords: cachedKws,
              }));
              return;
            }

            const LOGIN = process.env.DATAFORSEO_LOGIN;
            const PASSWORD = process.env.DATAFORSEO_PASSWORD;
            if (!LOGIN || !PASSWORD) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD not set in .env" }));
              return;
            }

            const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

            const AI_PROMPT_PATTERNS = [
              "how to", "how do", "what is", "what are", "what's", "why is",
              "best way to", "best tool", "best software", "best platform", "best app",
              "alternative to", "alternatives to", " vs ", "compare ", "instead of",
              "tool for ", "software for ", "app for ", "solution for ",
              "free ", "open source", "affordable", "cheap",
            ];

            function isAiPrompt(kw: string): boolean {
              const lower = kw.toLowerCase();
              return AI_PROMPT_PATTERNS.some((p) => lower.includes(p));
            }

            try {
              const apiRes = await fetch(
                "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
                {
                  method: "POST",
                  headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                  body: JSON.stringify([{ keywords: [keyword.trim()], location_name: "United States", language_name: "English" }]),
                  signal: AbortSignal.timeout(60_000),
                }
              );

              if (!apiRes.ok) {
                const text = await apiRes.text();
                res.writeHead(502);
                res.end(JSON.stringify({ error: `DataForSEO ${apiRes.status}: ${text.slice(0, 200)}` }));
                return;
              }

              const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
              const task = json.tasks?.[0];
              const apiCost = task?.cost ?? 0;
              const rawItems = (task?.result?.[0]?.items ?? []) as Array<{
                keyword: string; search_volume: number; cpc: number;
                competition: number; competition_level: string | null; impressions_per_day: number | null;
              }>;

              const { db: database } = await import("./src/db/index.js");
              const schema = await import("./src/db/schema.js");

              const rawTotal = rawItems.length;
              const filtered = rawItems.filter((k) => k.search_volume <= maxVolume && k.cpc >= minCpc);
              const scored = filtered.map((k) => ({
                ...k,
                opportunityScore: (k.search_volume * k.cpc) / ((k.competition ?? 0) + 0.01),
                isAiPrompt: isAiPrompt(k.keyword),
              })).sort((a, b) => b.opportunityScore - a.opportunityScore);

              const [run] = await database.insert(schema.seoRuns).values({
                projectId: projectId ?? null,
                market: marketSlug,
                seedKeyword: keyword.trim(),
                totalKeywords: scored.length,
                totalCost: apiCost,
                maxVolume,
                minCpc,
                purpose,
                opportunityId: opportunityId ?? null,
              }).returning({ id: schema.seoRuns.id });

              // If linked to an opportunity, write SEO stats back to it
              if (opportunityId && scored.length > 0) {
                const top = scored[0];
                const totalVol = scored.reduce((s: number, k: { search_volume: number }) => s + k.search_volume, 0);
                const avgCpcVal = scored.reduce((s: number, k: { cpc: number }) => s + k.cpc, 0) / scored.length;
                const volScore = Math.min(4, totalVol / 5000);
                const cpcScore = Math.min(3, avgCpcVal / 2);
                const demandScore = Math.min(10, volScore + cpcScore + Math.min(3, scored.length / 20));
                const { eq } = await import("drizzle-orm");
                await database.update(schema.opportunities)
                  .set({ seoRunId: run.id, topKeyword: top.keyword, seoVolume: totalVol, seoCpc: avgCpcVal, seoKeywordCount: scored.length, demandScore })
                  .where(eq(schema.opportunities.id, opportunityId));
              }

              for (const kw of scored) {
                await database.insert(schema.keywordOpportunities).values({
                  runId: run.id,
                  keyword: kw.keyword,
                  searchVolume: kw.search_volume,
                  cpc: kw.cpc,
                  competition: kw.competition ?? 0,
                  competitionLevel: kw.competition_level ?? null,
                  opportunityScore: kw.opportunityScore,
                  isAiPrompt: kw.isAiPrompt,
                  impressionsPerDay: kw.impressions_per_day ?? null,
                });
              }

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ runId: run.id, total: scored.length, rawTotal, cost: apiCost, keywords: scored }));
            } catch (err: unknown) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: String(err) }));
            }
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-autocomplete  - free Google Suggest expansion (AnswerThePublic style)
    // ------------------------------------------------------------------
    {
      name: "api:seo-autocomplete",
      configureServer(server) {
        server.middlewares.use(
          "/api/seo-autocomplete",
          async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== "POST") { res.writeHead(405); res.end(); return; }

            let body = "";
            for await (const chunk of req) body += chunk;
            let keyword: string;
            try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
            if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }

            // Generate query variants the same way AnswerThePublic does
            const QUESTIONS = ["what is", "what does", "what are", "how to", "how do I", "how does", "why is", "why does", "can I", "can you", "should I", "when to", "where to", "who uses", "which is best"];
            const COMPARISONS = ["vs", "versus", "alternative to", "alternatives to", "like", "similar to", "or", "compared to"];
            const PREPOSITIONS = ["for", "to", "with", "without", "near", "about", "before", "after"];
            const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

            const queries = [
              keyword,
              ...QUESTIONS.map((q) => `${q} ${keyword}`),
              ...COMPARISONS.map((c) => `${keyword} ${c}`),
              ...PREPOSITIONS.map((p) => `${keyword} ${p}`),
              ...ALPHABET.map((l) => `${keyword} ${l}`),
            ];

            async function suggest(q: string): Promise<string[]> {
              try {
                const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(q)}&client=firefox&hl=en&gl=us`;
                const r = await fetch(url, {
                  headers: { "User-Agent": "Mozilla/5.0" },
                  signal: AbortSignal.timeout(6000),
                });
                if (!r.ok) return [];
                const json = await r.json() as [string, string[]];
                return json[1] ?? [];
              } catch { return []; }
            }

            // Batch with small concurrency to avoid rate limits
            const results: Record<string, string[]> = {};
            const BATCH = 5;
            for (let i = 0; i < queries.length; i += BATCH) {
              const batch = queries.slice(i, i + BATCH);
              const settled = await Promise.all(batch.map(suggest));
              for (let j = 0; j < batch.length; j++) {
                if (settled[j].length > 0) results[batch[j]] = settled[j];
              }
              if (i + BATCH < queries.length) await new Promise((r) => setTimeout(r, 120));
            }

            // Group by type
            const groups: Record<string, string[]> = {
              questions: [],
              comparisons: [],
              prepositions: [],
              alphabetical: [],
              direct: [],
            };
            const seen = new Set<string>();

            function addUnique(key: keyof typeof groups, items: string[]) {
              for (const s of items) {
                if (!seen.has(s)) { seen.add(s); groups[key].push(s); }
              }
            }

            addUnique("direct", results[keyword] ?? []);
            for (const q of QUESTIONS) addUnique("questions", results[`${q} ${keyword}`] ?? []);
            for (const c of COMPARISONS) addUnique("comparisons", results[`${keyword} ${c}`] ?? []);
            for (const p of PREPOSITIONS) addUnique("prepositions", results[`${keyword} ${p}`] ?? []);
            for (const l of ALPHABET) addUnique("alphabetical", results[`${keyword} ${l}`] ?? []);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ groups, total: seen.size }));
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-runs  - list all past SEO search runs with their keywords
    // ------------------------------------------------------------------
    {
      name: "api:seo-runs",
      configureServer(server) {
        server.middlewares.use(
          "/api/seo-runs",
          async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== "/") { next(); return; }  // let /delete and other sub-paths pass through
            try {
              const { db: database } = await import("./src/db/index.js");
              const schema = await import("./src/db/schema.js");
              const { desc, eq, inArray, isNull } = await import("drizzle-orm");

              const projectIdParam = url.searchParams.get("projectId");
              const projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;

              const runs = projectId != null
                ? await database.select().from(schema.seoRuns).where(eq(schema.seoRuns.projectId, projectId)).orderBy(desc(schema.seoRuns.createdAt))
                : await database.select().from(schema.seoRuns).where(isNull(schema.seoRuns.projectId)).orderBy(desc(schema.seoRuns.createdAt));

              const runIds = runs.map((r: { id: number }) => r.id);
              const keywords = runIds.length > 0
                ? await database.select().from(schema.keywordOpportunities).where(inArray(schema.keywordOpportunities.runId, runIds)).orderBy(desc(schema.keywordOpportunities.opportunityScore))
                : [];

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ runs, keywords }));
            } catch (err: unknown) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: String(err) }));
            }
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-runs/delete - delete a run and its keywords
    // ------------------------------------------------------------------
    {
      name: "api:seo-runs-delete",
      configureServer(server) {
        server.middlewares.use("/api/seo-runs/delete", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let runId: number;
          try { runId = JSON.parse(body).runId; } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!runId) { res.writeHead(400); res.end("runId required"); return; }
          try {
            const { db: database } = await import("./src/db/index.js");
            const schema = await import("./src/db/schema.js");
            const { eq } = await import("drizzle-orm");
            await database.delete(schema.keywordOpportunities).where(eq(schema.keywordOpportunities.runId, runId));
            await database.delete(schema.seoRuns).where(eq(schema.seoRuns.id, runId));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err: unknown) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-clickstream - real user search behavior (Clickstream Data API)
    // ------------------------------------------------------------------
    {
      name: "api:seo-clickstream",
      configureServer(server) {
        server.middlewares.use("/api/seo-clickstream", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/keywords_data/clickstream_data/search_volume/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!apiRes.ok) {
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `DataForSEO ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<Record<string, unknown>> }> };
            const task = json.tasks?.[0];
            const items = (task?.result ?? []) as Array<{ keyword: string; search_volume: number; monthly_searches?: Array<{ year: number; month: number; search_volume: number }> }>;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ keywords: items, cost: task?.cost ?? 0 }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-reviews - Trustpilot review mining (search → top 3 → neg reviews)
    // ------------------------------------------------------------------
    {
      name: "api:seo-reviews",
      configureServer(server) {
        server.middlewares.use("/api/seo-reviews", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            // Step 1: find companies on Trustpilot matching keyword
            const searchRes = await fetch(
              "https://api.dataforseo.com/v3/business_data/trustpilot/search/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ keyword, depth: 10 }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!searchRes.ok) {
              if (searchRes.status === 404) {
                res.writeHead(402); res.end(JSON.stringify({ error: "addon_inactive" })); return;
              }
              const text = await searchRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `Trustpilot search ${searchRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const searchJson = await searchRes.json() as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            const companies = ((searchJson.tasks?.[0]?.result?.[0]?.items ?? []) as Array<{ domain: string; title: string; rating: number; reviews_count: number }>).slice(0, 3);

            if (companies.length === 0) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ companies: [] })); return;
            }

            // Step 2: fetch low-rated reviews for each company (pain signals)
            const companiesWithReviews: Array<typeof companies[0] & { reviews: unknown[] }> = [];
            for (const company of companies) {
              try {
                const reviewRes = await fetch(
                  "https://api.dataforseo.com/v3/business_data/trustpilot/reviews/live",
                  {
                    method: "POST",
                    headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                    body: JSON.stringify([{ domain: company.domain, depth: 30, ratings: [1, 2, 3] }]),
                    signal: AbortSignal.timeout(30_000),
                  }
                );
                const reviewJson = await reviewRes.json() as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> };
                const reviews = reviewJson.tasks?.[0]?.result?.[0]?.items ?? [];
                companiesWithReviews.push({ ...company, reviews });
              } catch {
                companiesWithReviews.push({ ...company, reviews: [] });
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ companies: companiesWithReviews }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-apps - Google Play app rankings for keyword
    // ------------------------------------------------------------------
    {
      name: "api:seo-apps",
      configureServer(server) {
        server.middlewares.use("/api/seo-apps", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/app_data/google/app_searches/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ keyword, location_code: 2840, language_code: "en", depth: 20 }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!apiRes.ok) {
              if (apiRes.status === 404) {
                res.writeHead(402); res.end(JSON.stringify({ error: "addon_inactive", addon: "app_data" })); return;
              }
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `App Data ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: unknown[] }> }> };
            const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ apps: items, cost: json.tasks?.[0]?.cost ?? 0 }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-serp - Google organic top-10 results
    // ------------------------------------------------------------------
    {
      name: "api:seo-serp",
      configureServer(server) {
        server.middlewares.use("/api/seo-serp", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/serp/google/organic/live/regular",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ keyword, location_code: 2840, language_code: "en", depth: 10, calculate_rectangles: false }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!apiRes.ok) {
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `SERP ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            const task = json.tasks?.[0];
            const allItems = (task?.result?.[0]?.items ?? []) as Array<Record<string, unknown>>;
            const organic = allItems.filter((item) => item.type === "organic");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ results: organic, cost: task?.cost ?? 0 }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-ai-demand - AI keyword data (what people ask ChatGPT / AIO)
    // ------------------------------------------------------------------
    {
      name: "api:seo-ai-demand",
      configureServer(server) {
        server.middlewares.use("/api/seo-ai-demand", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/ai_optimization/ai_keyword_data/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!apiRes.ok) {
              if (apiRes.status === 404) {
                res.writeHead(402); res.end(JSON.stringify({ error: "addon_inactive", addon: "ai_optimization" })); return;
              }
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `AI Demand ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<Record<string, unknown>> }> };
            const task = json.tasks?.[0];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ keywords: task?.result ?? [], cost: task?.cost ?? 0 }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-intent - DataForSEO Labs search_intent for a run's keywords
    // ------------------------------------------------------------------
    {
      name: "api:seo-intent",
      configureServer(server) {
        server.middlewares.use("/api/seo-intent", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let runId: number;
          try { runId = JSON.parse(body).runId; } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!runId) { res.writeHead(400); res.end("runId required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const { db: database } = await import("./src/db/index.js");
            const schema = await import("./src/db/schema.js");
            const { eq } = await import("drizzle-orm");
            const kwRows = await database.select().from(schema.keywordOpportunities).where(eq(schema.keywordOpportunities.runId, runId));
            if (kwRows.length === 0) { res.writeHead(200); res.end(JSON.stringify({ classified: 0, intents: {} })); return; }
            const keywords = kwRows.map((r: { keyword: string }) => r.keyword);
            const intents: Record<string, string> = {};
            let totalCost = 0;
            const BATCH = 100;
            for (let i = 0; i < keywords.length; i += BATCH) {
              const batch = keywords.slice(i, i + BATCH);
              try {
                const apiRes = await fetch(
                  "https://api.dataforseo.com/v3/dataforseo_labs/google/search_intent/live",
                  {
                    method: "POST",
                    headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                    body: JSON.stringify([{ keywords: batch, language_name: "English" }]),
                    signal: AbortSignal.timeout(30_000),
                  }
                );
                if (!apiRes.ok) continue;
                const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<{ keyword: string; keyword_intent: { main_intent: string } }> }> }> };
                const task = json.tasks?.[0];
                totalCost += task?.cost ?? 0;
                for (const item of task?.result?.[0]?.items ?? []) {
                  intents[item.keyword] = item.keyword_intent?.main_intent ?? "informational";
                }
              } catch { /* skip batch */ }
            }
            for (const row of kwRows) {
              const intent = intents[(row as { keyword: string }).keyword];
              if (intent) {
                await database.update(schema.keywordOpportunities)
                  .set({ searchIntent: intent })
                  .where(eq(schema.keywordOpportunities.id, (row as { id: number }).id));
              }
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ classified: Object.keys(intents).length, intents, cost: totalCost }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-keywords-for-site - DataForSEO Labs: what a domain ranks for
    // ------------------------------------------------------------------
    {
      name: "api:seo-keywords-for-site",
      configureServer(server) {
        server.middlewares.use("/api/seo-keywords-for-site", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let domain: string;
          try { domain = JSON.parse(body).domain?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!domain) { res.writeHead(400); res.end("domain required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{
                  target: cleanDomain,
                  location_code: 2840,
                  language_code: "en",
                  filters: [
                    ["keyword_data.keyword_info.cpc", ">", 0.5],
                    "and",
                    ["keyword_data.keyword_info.search_volume", ">", 10],
                  ],
                  order_by: ["keyword_data.keyword_info.cpc,desc"],
                  limit: 100,
                }]),
                signal: AbortSignal.timeout(30_000),
              }
            );
            if (!apiRes.ok) {
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `DataForSEO Labs ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<{ keyword: string; keyword_data: { keyword_info: { search_volume: number; cpc: number; competition: number; competition_level: string | null; keyword_difficulty?: number | null } } }> }> }> };
            const task = json.tasks?.[0];
            const items = task?.result?.[0]?.items ?? [];
            const keywords = items.map((item) => ({
              keyword: item.keyword,
              search_volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
              cpc: item.keyword_data?.keyword_info?.cpc ?? 0,
              competition: item.keyword_data?.keyword_info?.competition ?? 0,
              competition_level: item.keyword_data?.keyword_info?.competition_level ?? null,
              keyword_difficulty: item.keyword_data?.keyword_info?.keyword_difficulty ?? null,
            }));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ keywords, cost: task?.cost ?? 0, domain: cleanDomain }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-content-analysis - DataForSEO Content Analysis: web pain signals
    // ------------------------------------------------------------------
    {
      name: "api:seo-content-analysis",
      configureServer(server) {
        server.middlewares.use("/api/seo-content-analysis", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let keyword: string;
          try { keyword = JSON.parse(body).keyword?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!keyword) { res.writeHead(400); res.end("keyword required"); return; }
          const LOGIN = process.env.DATAFORSEO_LOGIN;
          const PASSWORD = process.env.DATAFORSEO_PASSWORD;
          if (!LOGIN || !PASSWORD) { res.writeHead(503); res.end(JSON.stringify({ error: "DATAFORSEO credentials not set" })); return; }
          const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
          try {
            const apiRes = await fetch(
              "https://api.dataforseo.com/v3/content_analysis/search/live",
              {
                method: "POST",
                headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
                body: JSON.stringify([{
                  keyword,
                  keyword_fields: { snippet: "keyword", title: "keyword" },
                  page_type: ["forum", "blog", "news", "reviews", "ecommerce"],
                  search_mode: "as_is",
                  limit: 25,
                  order_by: ["date_published,desc"],
                }]),
                signal: AbortSignal.timeout(45_000),
              }
            );
            if (!apiRes.ok) {
              const text = await apiRes.text();
              res.writeHead(502); res.end(JSON.stringify({ error: `Content Analysis ${apiRes.status}: ${text.slice(0, 300)}` })); return;
            }
            const json = await apiRes.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<{ type?: string; title?: string; url?: string; domain?: string; snippet?: string; date_published?: string; author?: string; content_info?: { connotation_types?: { negative?: number; positive?: number; neutral?: number } } }> }> }> };
            const task = json.tasks?.[0];
            const rawItems = task?.result?.[0]?.items ?? [];
            const items = rawItems.map((item) => {
              const c = item.content_info?.connotation_types ?? {};
              const neg = c.negative ?? 0;
              const pos = c.positive ?? 0;
              const neu = c.neutral ?? 0;
              const sentiment: "negative" | "positive" | "neutral" = neg >= pos && neg >= neu ? "negative" : pos >= neu ? "positive" : "neutral";
              return {
                type: item.type ?? "unknown",
                title: item.title ?? "",
                url: item.url ?? "",
                domain: item.domain ?? "",
                snippet: item.snippet ?? "",
                date_published: item.date_published ?? null,
                author: item.author ?? null,
                sentiment,
                negative_score: neg,
              };
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ items, cost: task?.cost ?? 0 }));
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/coolify-deploy - trigger a Coolify webhook deploy
    // ------------------------------------------------------------------
    {
      name: "api:coolify-deploy",
      configureServer(server) {
        server.middlewares.use("/api/coolify-deploy", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
          let body = "";
          for await (const chunk of req) body += chunk;
          let webhookUrl: string;
          try { webhookUrl = JSON.parse(body).webhookUrl?.trim(); } catch { res.writeHead(400); res.end("Bad JSON"); return; }
          if (!webhookUrl) { res.writeHead(400); res.end(JSON.stringify({ error: "webhookUrl required" })); return; }
          try {
            const r = await fetch(webhookUrl, { method: "POST", signal: AbortSignal.timeout(15_000) });
            const text = await r.text();
            if (r.ok) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true, message: text.slice(0, 200) }));
            } else {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: `${r.status}: ${text.slice(0, 200)}` }));
            }
          } catch (err: unknown) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/seo-pages  - generate + list static SEO pages for a project
    // ------------------------------------------------------------------
    {
      name: "api:seo-pages",
      configureServer(server) {
        server.middlewares.use("/api/seo-pages", async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const { db: database } = await import("./src/db/index.js");
            const schema = await import("./src/db/schema.js");
            const { eq, desc } = await import("drizzle-orm");
            const url = new URL(req.url ?? "/", "http://localhost");

            if (req.method === "GET") {
              const productId = parseInt(url.searchParams.get("productId") ?? url.searchParams.get("projectId") ?? "0", 10);
              if (!productId) { res.writeHead(400); res.end("productId required"); return; }
              const rows = await database.select().from(schema.seoPages)
                .where(eq(schema.seoPages.productId, productId))
                .orderBy(desc(schema.seoPages.createdAt));
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(rows));
              return;
            }

            if (req.method === "DELETE") {
              const id = parseInt(url.searchParams.get("id") ?? "0", 10);
              if (!id) { res.writeHead(400); res.end("id required"); return; }
              await database.delete(schema.seoPages).where(eq(schema.seoPages.id, id));
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              const { projectId, productId: productIdRaw, seoRunId, keywordId, targetKeyword, slug, title, metaDescription, projectContext, signalContext } = JSON.parse(body);
              const productId = productIdRaw ?? projectId;
              if (!productId || !targetKeyword) { res.writeHead(400); res.end("productId and targetKeyword required"); return; }

              const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
              if (!ANTHROPIC_KEY) { res.writeHead(503); res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" })); return; }

              const prompt = `You are an expert SEO content writer. Write a high-quality MDX landing page targeting the keyword "${targetKeyword}".

Requirements:
- H1 naturally includes the keyword
- 3-5 substantive H2 sections with real, useful content
- Use any provided context to make it authentic and specific
- Clear CTA at the end
- 600-900 words, MDX format
- Human, specific, opinionated - not generic filler

Target keyword: "${targetKeyword}"
Page slug: /${slug || targetKeyword.toLowerCase().replace(/\s+/g, "-")}
${projectContext ? `Product context: ${projectContext}` : ""}
${signalContext ? `Real user pain signals: ${signalContext}` : ""}

Output ONLY the MDX content.`;

              const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
                body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
                signal: AbortSignal.timeout(60_000),
              });

              if (!aiRes.ok) { res.writeHead(502); res.end(JSON.stringify({ error: `AI error: ${aiRes.status}` })); return; }
              const aiJson = await aiRes.json() as { content?: Array<{ text?: string }> };
              const content = aiJson.content?.[0]?.text ?? "";

              const finalSlug = slug || targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              const finalTitle = title || `${targetKeyword.charAt(0).toUpperCase() + targetKeyword.slice(1)} - Complete Guide`;
              const finalMeta = metaDescription || `${targetKeyword} - find the best solutions, comparisons, and expert tips.`;

              const [row] = await database.insert(schema.seoPages).values({
                productId, seoRunId: seoRunId ?? null, keywordId: keywordId ?? null,
                targetKeyword, slug: finalSlug, title: finalTitle,
                metaDescription: finalMeta, content, status: "draft",
              }).returning();

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(row));
              return;
            }

            res.writeHead(405); res.end();
          } catch (err: unknown) {
            res.writeHead(500); res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // /api/openrouter-key-info - proxy to OpenRouter key info endpoint
    {
      name: "api:openrouter-key-info",
      configureServer(server) {
        server.middlewares.use("/api/openrouter-key-info", async (_req, res) => {
          const apiKey = process.env.OPENROUTER_API_KEY;
          if (!apiKey) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "OPENROUTER_API_KEY not set" }));
            return;
          }
          try {
            const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            const body = await r.text();
            res.writeHead(r.status, { "Content-Type": "application/json" });
            res.end(body);
          } catch (err) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },

    // /api/load-prototype - read proto/index.html from a local repo path
    {
      name: "api:load-prototype",
      configureServer(server) {
        server.middlewares.use("/api/load-prototype", (req, res) => {
          const url = new URL(req.url ?? "", "http://localhost");
          const file = url.searchParams.get("file");
          if (!file) { res.writeHead(400); res.end("Missing file"); return; }
          try {
            const { readFileSync } = require("fs") as typeof import("fs");
            const { homedir } = require("os") as typeof import("os");
            const { resolve } = require("path") as typeof import("path");
            const expanded = file.startsWith("~/") ? resolve(homedir(), file.slice(2)) : resolve(file);
            const html = readFileSync(expanded, "utf-8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ html }));
          } catch {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `File not found: ${file}` }));
          }
        });
      },
    },

    // ------------------------------------------------------------------
    // /api/health-check  - probe a domain for liveness and latency
    // ------------------------------------------------------------------
    {
      name: "api:health-check",
      configureServer(server) {
        server.middlewares.use(
          "/api/health-check",
          async (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, "http://localhost");
            const domain = url.searchParams.get("domain")?.trim();

            if (!domain) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, statusCode: 0, error: "domain required" }));
              return;
            }

            const target = `https://${domain}`;
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(), 5_000);
            const started = Date.now();

            try {
              const response = await fetch(target, {
                method: "GET",
                redirect: "follow",
                signal: ac.signal,
                headers: { "User-Agent": "BurningDemand-HealthCheck/1.0" },
              });
              clearTimeout(timer);
              const latencyMs = Date.now() - started;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: response.ok || response.status < 500, statusCode: response.status, latencyMs }));
            } catch (err: any) {
              clearTimeout(timer);
              const isTimeout = err?.name === "AbortError" || err?.code === "UND_ERR_CONNECT_TIMEOUT";
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                ok: false,
                statusCode: 0,
                error: isTimeout ? "timeout" : (err?.message ?? "unreachable"),
              }));
            }
          }
        );
      },
    },

    // ------------------------------------------------------------------
    // Channel cron scheduler - runs every 15 min
    // ------------------------------------------------------------------
    {
      name: "channel-cron",
      configureServer() {
        startChannelCron();
      },
    },

    tailwindcss(),
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    tsconfigPaths(),
  ],
});
