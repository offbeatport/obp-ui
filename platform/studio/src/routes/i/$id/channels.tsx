import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getProjectChannels, updateProjectChannels, updateChannelConfig,
  toggleChannelStatus, generateFromCustomPrompt, getChannelSignalCounts,
  discoverSubreddits, updateProjectScanSchedule,
  triggerDeepScan, getChannelProfile, getChannelScanStatus,
} from "~/lib/project-fns";
import { CHANNEL_GROUPS, CHANNEL_LABELS, CHANNEL_COST, CHANNEL_COST_LABEL, CHANNEL_DISABLED, CHANNEL_RATE_LIMITS } from "~/lib/channels";
import type { ChannelCost } from "~/lib/channels";
import type { ChannelType } from "~/lib/channels";
import { channelEditPrompt } from "~/lib/prompts";
import { ChannelIcon } from "~/lib/channel-icons";
import { Button } from "~/components/ui/Button";
import { Dropdown } from "~/components/ui/Dropdown";
import { useProjectContext } from "~/lib/project-context";
import {
  ChevronDown, SlidersHorizontal, Sparkles, X, Plus,
  Play, Power, Terminal, ChevronUp, Trash2, Maximize2, Minimize2, Square,
} from "lucide-react";
import type { Channel, ChannelProfileData } from "~/db/schema";
import type { Project } from "~/db/schema";

export const Route = createFileRoute("/i/$id/channels")({
  loader: async ({ params }) => {
    const projectId = parseInt(params.id, 10);
    const channels = await getProjectChannels({ data: { projectId } });
    const channelIds = channels.map((c) => c.id);
    const signalCounts = channelIds.length > 0
      ? await getChannelSignalCounts({ data: { channelIds } })
      : {} as Record<number, { total: number; lastRun: number }>;
    return { signalCounts };
  },
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: ChannelsPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Config = { keywords: string[]; subreddits: string[]; competitors?: string[] };

export type LogLevel = "info" | "success" | "error" | "warn";
export type LogEntry = {
  id: number;
  ts: Date;
  channelId: number | null;
  channelLabel: string;
  level: LogLevel;
  message: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let logIdSeq = 0;
function makeLog(channelId: number | null, channelLabel: string, level: LogLevel, message: string): LogEntry {
  return { id: ++logIdSeq, ts: new Date(), channelId, channelLabel, level, message };
}

function configOf(ch: Channel): Config {
  const raw = (ch.config ?? {}) as { keywords?: string[]; subreddits?: string[]; competitors?: string[] };
  return { keywords: raw.keywords ?? [], subreddits: raw.subreddits ?? [], competitors: raw.competitors ?? [] };
}

function fmtTime(d: Date) {
  return d.toTimeString().slice(0, 8);
}

function formatRunTime(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago at ${d.toTimeString().slice(0, 5)}`;
  if (diffDay === 1) return `yesterday at ${d.toTimeString().slice(0, 5)}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${d.toTimeString().slice(0, 5)}`;
}

// ── Per-project log persistence ───────────────────────────────────────────────

type StoredLogs = {
  logs: LogEntry[];
  newSignalsCount: number;
  processStats: ProcessStats;
  lastRunAt: string | null; // ISO string
};

const LS_KEY = (id: number) => `bd:ch-logs:${id}`;
const MAX_PERSISTED_LOGS = 150; // cap to stay well within localStorage limits

function loadChannelLogs(projectId: number): StoredLogs | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LS_KEY(projectId));
    if (!raw) return null;
    const p = JSON.parse(raw) as { logs: any[]; newSignalsCount: number; processStats: ProcessStats; lastRunAt: string | null };
    // Deserialise ts strings back to Date objects
    const logs: LogEntry[] = p.logs.map((l) => ({ ...l, ts: new Date(l.ts) }));
    return { ...p, logs };
  } catch { return null; }
}

function saveChannelLogs(projectId: number, state: Omit<StoredLogs, "logs"> & { logs: LogEntry[] }) {
  try {
    if (typeof localStorage === "undefined") return;
    // Serialise - ts Date → ISO string happens via JSON.stringify replacer
    const serialised = JSON.stringify({
      ...state,
      logs: state.logs.slice(-MAX_PERSISTED_LOGS),
    }, (_, v) => v instanceof Date ? v.toISOString() : v);
    localStorage.setItem(LS_KEY(projectId), serialised);
  } catch { /* quota errors - silently ignore */ }
}

function clearChannelLogs(projectId: number) {
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY(projectId)); } catch { }
}

// In-memory cache so switching tabs doesn't re-parse localStorage each time
const channelLogStore = new Map<number, StoredLogs>();

// ── Main page ─────────────────────────────────────────────────────────────────

function ChannelsPage() {
  const { project, channels, setChannels } = useProjectContext();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const [channelDraft, setChannelDraft] = useState<Set<ChannelType>>(
    new Set(channels.map((c) => c.type as ChannelType))
  );
  const [busyChannels, setBusyChannels] = useState(false);
  const { signalCounts: initialSignalCounts } = Route.useLoaderData();
  const [signalCounts, setSignalCounts] = useState(initialSignalCounts);

  async function refreshSignalCounts(chs = channels) {
    const ids = chs.map((c) => c.id);
    if (ids.length === 0) return;
    const counts = await getChannelSignalCounts({ data: { channelIds: ids } });
    setSignalCounts(counts);
  }

  // Project-level scan schedule
  const [schedule, setSchedule] = useState<"manual" | "daily" | "weekly">(
    (project.scanSchedule as "manual" | "daily" | "weekly") ?? "manual"
  );
  const [schedBusy, setSchedBusy] = useState(false);

  async function handleScheduleChange(value: "manual" | "daily" | "weekly") {
    setSchedBusy(true);
    try {
      await updateProjectScanSchedule({ data: { projectId: project.id, schedule: value } });
      setSchedule(value);
    } finally {
      setSchedBusy(false);
    }
  }

  const [lookbackDays, setLookbackDays] = useState<number>(30);
  useEffect(() => {
    const saved = localStorage.getItem("lookbackDays");
    if (saved) setLookbackDays(parseInt(saved, 10));
  }, []);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [runningChannels, setRunningChannels] = useState<Set<number>>(new Set());
  const [queuedChannels, setQueuedChannels] = useState<Map<number, number>>(new Map()); // channelId → queue position
  const [lastRunAt, setLastRunAt] = useState<Date | null>(() => {
    const dates = channels.map((c) => c.lastRunAt).filter(Boolean) as Date[];
    return dates.length ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))) : null;
  });
  // Channels whose scraper finished but process.ts is still running
  const [doneScrapingChannels, setDoneScrapingChannels] = useState<Set<number>>(new Set());

  const jobCacheRef = useRef<Map<string, { channelId: number; channelType: string; projectId: number }>>(new Map());
  // channelId → jobId, so we can stop specific channels
  const channelJobIdRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    const es = new EventSource("/api/channel-jobs/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "snapshot") {
          for (const j of event.jobs) {
            jobCacheRef.current.set(j.id, { channelId: j.channelId, channelType: j.channelType, projectId: j.projectId });
          }
          const projectJobs = event.jobs.filter((j: any) => j.projectId === project.id);
          const running = new Set<number>(projectJobs.filter((j: any) => j.status === "running").map((j: any) => j.channelId));
          setRunningChannels(running);
          const qm = new Map<number, number>(projectJobs.filter((j: any) => j.status === "queued").map((j: any) => [j.channelId, j.queuePosition ?? 0]));
          setQueuedChannels(qm);

          // On page refresh the in-memory store is empty - replay buffered server logs
          if (!channelLogStore.has(project.id)) {
            const projectJobs = event.jobs.filter((j: any) => j.projectId === project.id);
            for (const j of projectJobs) {
              if (j.logs?.length > 0) {
                const label = CHANNEL_LABELS[j.channelType as ChannelType] ?? j.channelType;
                for (const line of j.logs as string[]) {
                  addLog(j.channelId, label, "info", line);
                }
              }
              // Restore lastRunAt from completed jobs
              if (j.endedAt && j.status === "completed") {
                setLastRunAt((prev) => {
                  const t = new Date(j.endedAt);
                  return !prev || t > prev ? t : prev;
                });
              }
            }
          }
        } else if (event.type === "created") {
          const j = event.job;
          jobCacheRef.current.set(j.id, { channelId: j.channelId, channelType: j.channelType, projectId: j.projectId });
          if (j.projectId === project.id) {
            channelJobIdRef.current.set(j.channelId, j.id);
            if (j.status === "queued") {
              setQueuedChannels(prev => new Map(prev).set(j.channelId, j.queuePosition ?? 0));
              const label = CHANNEL_LABELS[j.channelType as ChannelType] ?? j.channelType;
              addLog(j.channelId, label, "info", `Queued (position ${j.queuePosition ?? "?"})`);
              setLogCollapsed(false);
            } else {
              setRunningChannels((prev) => {
                if (prev.size === 0) { setNewSignalsCount(0); setProcessStats({}); setDoneScrapingChannels(new Set()); }
                return new Set(prev).add(j.channelId);
              });
              const label = CHANNEL_LABELS[j.channelType as ChannelType] ?? j.channelType;
              addLog(j.channelId, label, "info", "Scout started…");
              setLogCollapsed(false);
            }
          }
        } else if (event.type === "queued") {
          const cached = jobCacheRef.current.get(event.jobId);
          if (!cached || cached.projectId !== project.id) return;
          setQueuedChannels(prev => new Map(prev).set(cached.channelId, event.position));
        } else if (event.type === "started") {
          const cached = jobCacheRef.current.get(event.jobId);
          if (!cached || cached.projectId !== project.id) return;
          setQueuedChannels(prev => { const n = new Map(prev); n.delete(cached.channelId); return n; });
          setRunningChannels(prev => new Set(prev).add(cached.channelId));
          const label = CHANNEL_LABELS[cached.channelType as ChannelType] ?? cached.channelType;
          addLog(cached.channelId, label, "info", "Scout started…");
        } else if (event.type === "log") {
          const cached = jobCacheRef.current.get(event.jobId);
          if (!cached || cached.projectId !== project.id) return;
          const label = CHANNEL_LABELS[cached.channelType as ChannelType] ?? cached.channelType;
          addLog(cached.channelId, label, "info", event.line);
        } else if (event.type === "ended") {
          const cached = jobCacheRef.current.get(event.jobId);
          if (!cached || cached.projectId !== project.id) return;
          channelJobIdRef.current.delete(cached.channelId);
          setRunningChannels((s) => { const n = new Set(s); n.delete(cached.channelId); return n; });
          setQueuedChannels((s) => { const n = new Map(s); n.delete(cached.channelId); return n; });
          setDoneScrapingChannels((s) => { const n = new Set(s); n.delete(cached.channelId); return n; });
          if (event.status === "completed") setLastRunAt(new Date(event.endedAt));
          const label = CHANNEL_LABELS[cached.channelType as ChannelType] ?? cached.channelType;
          addLog(cached.channelId, label, event.status === "completed" ? "success" : "error",
            event.status === "completed" ? "Scout complete." : `Failed (exit ${event.exitCode})`);
          if (event.status === "completed") refreshSignalCounts();
        }
      } catch { }
    };
    es.onerror = () => { };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Load from memory first, fall back to localStorage on first mount (e.g. page refresh)
  const _initStored = (() => {
    const mem = channelLogStore.get(project.id);
    if (mem) return mem;
    const ls = loadChannelLogs(project.id);
    if (ls) { channelLogStore.set(project.id, ls); return ls; }
    return null;
  })();

  const [logs, setLogs] = useState<LogEntry[]>(_initStored?.logs ?? []);
  const [logFilter, setLogFilter] = useState<number | null>(null);
  const [requestCounts, setRequestCounts] = useState<Record<number, number>>({}); // channelId → API request count
  const [newSignalsCount, setNewSignalsCount] = useState(_initStored?.newSignalsCount ?? 0);
  const [processStats, setProcessStats] = useState<ProcessStats>(_initStored?.processStats ?? {});

  // Restore lastRunAt from persisted state if not already set from channel records
  useEffect(() => {
    if (_initStored?.lastRunAt) {
      setLastRunAt((prev) => {
        const persisted = new Date(_initStored.lastRunAt!);
        return !prev || persisted > prev ? persisted : prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Sync to memory + debounce-write to localStorage
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const snapshot = { logs, newSignalsCount, processStats, lastRunAt: lastRunAt?.toISOString() ?? null };
    channelLogStore.set(project.id, snapshot);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => saveChannelLogs(project.id, snapshot), 1_000);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, [logs, newSignalsCount, processStats, lastRunAt, project.id]);
  const [logPanelHeight, setLogPanelHeight] = useState(320);
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [logMaximized, setLogMaximized] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const dropBtnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((channelId: number | null, channelLabel: string, level: LogLevel, message: string) => {
    // Parse and strip the [reqs:N] real-time request counter tag
    const mReqsInline = message.match(/^\[reqs:(\d+)\]$/);
    if (mReqsInline) {
      if (channelId !== null) setRequestCounts((prev) => ({ ...prev, [channelId]: parseInt(mReqsInline[1], 10) }));
      return; // don't add to log display
    }
    setLogs((prev) => [...prev.slice(-499), makeLog(channelId, channelLabel, level, message)]);

    // Accumulate scraper "N new" signal counts
    const mNew = message.match(/\b(\d+) new\b/);
    if (mNew) setNewSignalsCount((n) => n + parseInt(mNew[1], 10));

    // Detect scrape-complete transition (scraper done, waiting for process.ts)
    if (channelId !== null && /Scrape complete|Rate limited/.test(message)) {
      setDoneScrapingChannels((s) => new Set(s).add(channelId));
    }

    // Parse process.ts funnel stats - each line updates one field
    const mFound = message.match(/Found (\d+) unprocessed signals/);
    if (mFound) setProcessStats((s) => ({ ...s, found: parseInt(mFound[1], 10) }));

    const mShort = message.match(/Dropped (\d+) signals \(< 80/);
    if (mShort) setProcessStats((s) => ({ ...s, droppedShort: parseInt(mShort[1], 10) }));

    const mDupe = message.match(/Dropped (\d+) near-duplicate/);
    if (mDupe) setProcessStats((s) => ({ ...s, droppedDupe: parseInt(mDupe[1], 10) }));

    const mStale = message.match(/Dropped (\d+) stale/);
    if (mStale) setProcessStats((s) => ({ ...s, droppedStale: parseInt(mStale[1], 10) }));

    const mNoise = message.match(/Dropped (\d+) low-quality/);
    if (mNoise) setProcessStats((s) => ({ ...s, droppedNoise: parseInt(mNoise[1], 10) }));

    const mScored = message.match(/✓ (\d+) signals proceeding to clustering/);
    if (mScored) setProcessStats((s) => ({ ...s, prescored: parseInt(mScored[1], 10) }));

    const mDone = message.match(/Done\. Created: (\d+) opportunities/);
    if (mDone) setProcessStats((s) => ({ ...s, opportunities: parseInt(mDone[1], 10) }));

  }, []);

  useEffect(() => {
    setChannelDraft(new Set(channels.map((c) => c.type as ChannelType)));
  }, [channels]);

  useEffect(() => {
    if (!logCollapsed) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logCollapsed]);

  useEffect(() => {
    if (!dropOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (dropBtnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setDropOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dropOpen]);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: logPanelHeight };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setLogPanelHeight(Math.max(100, Math.min(500, dragRef.current.startH + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function handleRunChannel(ch: Channel) {
    if (runningChannels.has(ch.id)) return;
    try {
      await fetch("/api/channel-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: ch.id,
          channelType: ch.type,
          projectId: project.id,
          projectName: project.name,
          lookbackDays,
        }),
      });
    } catch (err) {
      const label = CHANNEL_LABELS[ch.type as ChannelType] ?? ch.type;
      addLog(ch.id, label, "error", String(err));
    }
  }

  async function handleRunAll() {
    const active = channels.filter((c) => c.status === "active" && !runningChannels.has(c.id));
    if (active.length === 0) return;
    await Promise.allSettled(active.map((ch) => handleRunChannel(ch)));
  }

  async function handleStopChannel(ch: Channel) {
    const jobId = channelJobIdRef.current.get(ch.id);
    if (!jobId) return;
    await fetch(`/api/channel-jobs/stop/${jobId}`, { method: "POST" });
  }

  async function handleStopAll() {
    await fetch("/api/channel-jobs/stop-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
  }

  async function handleToggleStatus(ch: Channel) {
    const next = ch.status === "active" ? "paused" : "active";
    setTogglingId(ch.id);
    try {
      await toggleChannelStatus({ data: { channelId: ch.id, status: next } });
      setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, status: next } : c));
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved(channelId: number, keywords: string[], subreddits: string[], competitors: string[]) {
    setChannels((prev) =>
      prev.map((c) => c.id === channelId ? { ...c, config: { keywords, subreddits, competitors } } : c)
    );
    setEditingChannel(null);
  }

  const savedChannelTypes = new Set(channels.map((c) => c.type as ChannelType));
  const hasChannelChanges =
    channelDraft.size !== savedChannelTypes.size ||
    [...channelDraft].some((t) => !savedChannelTypes.has(t));

  function openDrop() {
    if (!dropBtnRef.current) return;
    const r = dropBtnRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setDropOpen((v) => !v);
  }

  async function saveChannels() {
    setBusyChannels(true);
    try {
      await updateProjectChannels({
        data: {
          projectId: project.id,
          channelTypes: [...channelDraft],
          name: project.name,
          hypothesis: project.hypothesis ?? undefined,
        },
      });
      const updated = await getProjectChannels({ data: { projectId: project.id } });
      setChannels(updated);
      setDropOpen(false);
    } finally {
      setBusyChannels(false);
    }
  }

  const filteredLogs = logFilter === null ? logs : logs.filter((l) => l.channelId === logFilter || l.channelId === null);

  const dropdown = dropOpen && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: "fixed", top: dropPos.top, right: dropPos.right,
        width: 300, background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)", borderRadius: "var(--radius)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.65)", zIndex: 9999,
        maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="overflow-y-auto flex-1 py-2">
        {CHANNEL_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-4 pt-2 pb-1 text-[0.58rem] font-bold tracking-widest uppercase text-fg-subtle">
              {group.label}
            </div>
            {group.channels.map((type) => {
              const on = channelDraft.has(type);
              const isDisabled = CHANNEL_DISABLED.has(type);
              return (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isDisabled) return;
                    setChannelDraft((prev) => {
                      const next = new Set(prev);
                      next.has(type) ? next.delete(type) : next.add(type);
                      return next;
                    });
                  }}
                  disabled={busyChannels || isDisabled}
                  title={isDisabled ? "Not yet implemented" : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "6px 16px",
                    justifyContent: "flex-start", textAlign: "left",
                    borderRadius: 0, height: "auto",
                    opacity: isDisabled ? 0.35 : 1,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <span style={{
                    width: 14, height: 14, flexShrink: 0,
                    border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
                    borderRadius: 2, background: on ? "var(--accent)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.1s, border-color 0.1s",
                  }}>
                    {on && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="#010407" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <ChannelIcon type={type} size={12} style={{ color: on ? "var(--fg-muted)" : "var(--fg-subtle)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.82rem", color: on ? "var(--fg)" : "var(--fg-subtle)", fontWeight: on ? 500 : 400, flex: 1, textAlign: "left" }}>
                    {CHANNEL_LABELS[type]}
                  </span>
                  {isDisabled
                    ? <span style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.35)", fontStyle: "italic" }}>soon</span>
                    : <CostBadge cost={CHANNEL_COST[type]} />
                  }
                </Button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="px-4 py-[10px] border-t border-border flex items-center gap-2 flex-shrink-0">
        {hasChannelChanges ? (
          <>
            <Button variant="primary" size="sm" onClick={saveChannels} disabled={busyChannels}>
              {busyChannels ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setChannelDraft(savedChannelTypes)} disabled={busyChannels}>
              Discard
            </Button>
          </>
        ) : (
          <span className="text-xs text-fg-subtle">
            {channelDraft.size > 0
              ? `${channelDraft.size} channel${channelDraft.size !== 1 ? "s" : ""} selected`
              : "No channels selected"}
          </span>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  const activeCount = channels.filter((c) => c.status === "active").length;
  const anyRunning = runningChannels.size > 0 || queuedChannels.size > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Spin keyframes - injected once */}
      <style>{`@keyframes bd-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Taskbar */}
      <div className="flex items-center gap-3 px-6 h-[46px] border-b border-border flex-shrink-0">
        {/* Left: info */}
        <span className="text-xs text-fg-subtle flex-shrink-0">
          {(() => {
            const total = channels.length;
            if (total === 0) return "No channels configured";
            return `${activeCount} of ${total} channel${total !== 1 ? "s" : ""} active`;
          })()}
        </span>
        {(() => {
          const PAID_COST_USD: Partial<Record<ChannelType, number>> = { trustpilot: 0.05 };
          const activeChannels = channels.filter((c) => c.status === "active");
          const paidActive = activeChannels.filter((c) => CHANNEL_COST[c.type as ChannelType] === "paid");
          const estimatedCost = paidActive.reduce((sum, c) => sum + (PAID_COST_USD[c.type as ChannelType] ?? 0.05), 0);
          const freeCount = activeChannels.filter((c) => CHANNEL_COST[c.type as ChannelType] === "free").length;
          const keyCount = activeChannels.filter((c) => CHANNEL_COST[c.type as ChannelType] === "key").length;
          if (activeChannels.length === 0) return null;
          return (
            <span className="text-xs text-fg-subtle border-l border-border pl-3">
              {estimatedCost > 0
                ? <>est. <strong style={{ color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>${estimatedCost.toFixed(2)}</strong> per run</>
                : <span style={{ color: "rgba(34,197,94,0.7)" }}>free run</span>}
              {" · "}
              {[
                freeCount > 0 && `${freeCount} free`,
                keyCount > 0 && `${keyCount} API key`,
                paidActive.length > 0 && `${paidActive.length} paid (${paidActive.map((c) => c.type).join(", ")})`,
              ].filter(Boolean).join(" · ")}
            </span>
          );
        })()}

        <div className="ml-auto flex items-center gap-2">
          {/* Right: Configure → Lookback → Run All → Stop All */}
          <Button
            ref={dropBtnRef}
            variant="outline"
            size="sm"
            onClick={openDrop}
            style={{ gap: 6, background: dropOpen ? "rgba(165,182,214,0.08)" : "transparent", fontSize: "0.78rem" }}
          >
            <SlidersHorizontal size={12} />
            Configure
            <ChevronDown size={10} style={{ opacity: 0.6 }} />
          </Button>
          <Dropdown
            label="Lookback"
            value={lookbackDays}
            align="right"
            options={[
              { value: 1, label: "24h" },
              { value: 7, label: "7 days" },
              { value: 14, label: "14 days" },
              { value: 30, label: "1 month" },
              { value: 90, label: "3 months" },
              { value: 180, label: "6 months" },
              { value: 365, label: "1 year" },
            ]}
            onChange={(v) => {
              setLookbackDays(v);
              localStorage.setItem("lookbackDays", String(v));
            }}
          />
          {/* Project scan schedule */}
          <select
            value={schedule}
            disabled={schedBusy}
            onChange={e => handleScheduleChange(e.target.value as "manual" | "daily" | "weekly")}
            style={{
              background: "var(--bg-elevated)",
              border: `1px solid ${schedule !== "manual" ? "rgba(96,165,250,0.35)" : "var(--border-strong)"}`,
              borderRadius: "var(--radius)",
              color: schedule !== "manual" ? "var(--accent)" : "var(--fg-subtle)",
              fontSize: "0.76rem", fontFamily: "inherit",
              padding: "4px 8px", cursor: schedBusy ? "not-allowed" : "pointer",
              outline: "none", opacity: schedBusy ? 0.6 : 1,
            }}
          >
            <option value="manual">Manual</option>
            <option value="daily">Auto · daily</option>
            <option value="weekly">Auto · weekly</option>
          </select>

          <Button
            variant="primary"
            size="sm"
            disabled={anyRunning || activeCount === 0}
            onClick={handleRunAll}
          >
            {anyRunning
              ? <><span style={{ animation: "bd-spin 0.9s linear infinite", display: "inline-block", width: 8, height: 8, border: "1.5px solid transparent", borderTopColor: "#010407", borderRadius: "50%", marginRight: 6, verticalAlign: "middle" }} />Running…</>
              : "Run all"}
          </Button>
          {anyRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopAll}
              style={{ gap: 5, color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}
            >
              <Square size={10} />
              Stop all
            </Button>
          )}
        </div>
      </div>

      {dropdown}

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {channels.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-border">
                <th style={TH({ width: 40 })} />
                <th style={TH({ width: 180 })}>Channel</th>
                <th style={TH({})}>Keywords</th>
                <th style={TH({})}>Communities</th>
                <th style={TH({ width: 80 })}>Cost</th>
                <th style={TH({ width: 140 })}>Rate Limit</th>
                <th style={TH({ width: 80 })}>Requests</th>
                <th style={TH({ width: 100 })}>Signals</th>
                <th style={TH({ width: 96 })} />
              </tr>
            </thead>
            <tbody>
              {channels.filter((ch) => ch.type in CHANNEL_LABELS).map((ch) => {
                const cfg = configOf(ch);
                const isActive = ch.status === "active";
                const isRunning = runningChannels.has(ch.id);
                const isQueued = queuedChannels.has(ch.id);
                const queuePos = queuedChannels.get(ch.id);
                const isToggling = togglingId === ch.id;
                const isReddit = ch.type === "reddit";
                return (
                  <tr
                    key={ch.id}
                    onClick={() => setEditingChannel(ch)}
                    className="channel-row"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      verticalAlign: "middle",
                      opacity: isActive ? 1 : 0.45,
                      transition: "opacity 0.15s, background 0.1s",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {/* Status dot */}
                    <td style={{ padding: "0 0 0 18px", width: 40 }}>
                      {isQueued ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                          {queuePos != null && queuePos > 0 && (
                            <span style={{ fontSize: "0.60rem", color: "#f59e0b", fontWeight: 700 }}>#{queuePos}</span>
                          )}
                        </div>
                      ) : (
                        <StatusDot isActive={isActive} isRunning={isRunning} isScrapeComplete={doneScrapingChannels.has(ch.id)} />
                      )}
                    </td>

                    {/* Channel name */}
                    <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                      <div className="flex items-center gap-2">
                        <ChannelIcon type={ch.type as ChannelType} size={13} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                        <span className="text-sm font-medium text-fg">
                          {CHANNEL_LABELS[ch.type as ChannelType]}
                        </span>
                      </div>
                    </td>

                    {/* Keywords */}
                    <td style={{ padding: "14px 20px" }}>
                      <KeywordPreview items={cfg.keywords} />
                    </td>

                    {/* Communities */}
                    <td style={{ padding: "14px 20px" }}>
                      {isReddit && cfg.subreddits.length > 0
                        ? <KeywordPreview items={cfg.subreddits} prefix="r/" accentColor />
                        : <span className="text-sm text-fg-subtle">-</span>
                      }
                    </td>

                    {/* Cost */}
                    <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                      <CostBadge cost={CHANNEL_COST[ch.type as ChannelType]} />
                    </td>

                    {/* Rate Limit */}
                    <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                      <RateLimitBadge type={ch.type as ChannelType} />
                    </td>

                    {/* Request count */}
                    <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                      {requestCounts[ch.id] !== undefined ? (
                        <span className="text-sm text-fg-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {requestCounts[ch.id].toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-fg-subtle">-</span>
                      )}
                    </td>

                    {/* Signal counts */}
                    <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                      {(() => {
                        const counts = signalCounts[ch.id];
                        if (!counts) return <span className="text-xs text-fg-subtle">-</span>;
                        return (
                          <div className="flex flex-col gap-[2px]">
                            <span className="text-sm font-semibold text-fg" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {counts.lastRun > 0 ? `+${counts.lastRun}` : counts.total > 0 ? counts.total : "-"}
                            </span>
                            {counts.lastRun > 0 && counts.total > 0 && (
                              <span className="text-[0.66rem] text-fg-subtle" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {counts.total} total
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Schedule selector */}
                    <td style={{ padding: "10px 14px", width: 130 }} onClick={(e) => e.stopPropagation()}>
                    </td>

                    {/* Hover actions */}
                    <td style={{ padding: "0 14px 0 0", width: 96 }}>
                      <div className={isRunning ? "" : "channel-row-actions"}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2,
                          opacity: isRunning ? 1 : 0,
                          transition: "opacity 0.1s",
                          pointerEvents: isRunning ? "auto" : "none",
                        }}>
                        {isRunning ? (
                          <RowIconBtn
                            icon={<Square size={11} />}
                            title="Stop channel"
                            disabled={false}
                            onClick={() => handleStopChannel(ch)}
                            danger
                          />
                        ) : (
                          <RowIconBtn
                            icon={<Play size={11} />}
                            title="Run channel"
                            disabled={isToggling || !isActive}
                            onClick={() => handleRunChannel(ch)}
                            accent
                          />
                        )}
                        <RowIconBtn
                          icon={<Power size={11} />}
                          title={isActive ? "Disable channel" : "Enable channel"}
                          disabled={isToggling}
                          onClick={() => handleToggleStatus(ch)}
                          danger={isActive}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 px-8">
            <p className="m-0 text-sm text-fg-subtle italic">
              No channels configured - use "Configure" to add some.
            </p>
          </div>
        )}
      </div>

      {/* Log panel */}
      <div
        className="flex-shrink-0 border-t border-border flex flex-col min-h-[36px]"
        style={{
          height: logCollapsed ? 36 : logMaximized ? "calc(100vh - 128px)" : logPanelHeight,
          transition: "height 0.15s",
          background: "#050607",
        }}
      >
        {/* Drag handle */}
        {!logCollapsed && !logMaximized && (
          <div
            onMouseDown={onDragStart}
            className="h-1 flex-shrink-0 cursor-row-resize"
            style={{ background: "transparent" }}
          />
        )}

        {/* Log header */}
        <div
          className="flex items-center gap-2 px-[14px] flex-shrink-0"
          style={{
            height: 36,
            borderBottom: logCollapsed ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Terminal size={11} style={{ color: "var(--accent)", opacity: 0.7, flexShrink: 0 }} />
          <span className="text-[0.62rem] font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
            Logs
          </span>

          {/* Pipeline stats - always shown */}
          <PipelineStatus scraped={newSignalsCount} running={anyRunning} stats={processStats} lastRunAt={lastRunAt ?? undefined} />

          {logs.length > 0 && !logCollapsed && (
            <select
              value={logFilter ?? ""}
              onChange={(e) => setLogFilter(e.target.value === "" ? null : Number(e.target.value))}
              style={{
                marginLeft: 8, height: 20, padding: "0 6px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 3, color: "rgba(255,255,255,0.45)",
                fontSize: "0.70rem", fontFamily: "inherit", cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="">All channels</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {CHANNEL_LABELS[ch.type as ChannelType] ?? ch.type}
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex items-center gap-[6px]">
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setLogs([]); setNewSignalsCount(0); setProcessStats({}); channelLogStore.delete(project.id); clearChannelLogs(project.id); }}
                title="Clear logs"
                style={{ color: "rgba(255,255,255,0.25)", height: "auto", padding: "3px 4px" }}
              >
                <Trash2 size={10} />
              </Button>
            )}
            {!logCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogMaximized((v) => !v)}
                title={logMaximized ? "Restore" : "Maximize logs"}
                style={{ color: "rgba(255,255,255,0.25)", height: "auto", padding: "3px 4px" }}
              >
                {logMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLogCollapsed((v) => !v); setLogMaximized(false); }}
              title={logCollapsed ? "Expand logs" : "Collapse logs"}
              style={{ color: "rgba(255,255,255,0.25)", height: "auto", padding: "3px 4px" }}
            >
              {logCollapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </Button>
          </div>
        </div>

        {/* Log body */}
        {!logCollapsed && (
          <div
            className="flex-1 overflow-y-auto py-[6px]"
            style={{
              fontFamily: "inherit",
              lineHeight: 1.7,
            }}
          >
            {filteredLogs.length === 0 ? (
              <div className="px-4 py-[10px] italic" style={{ color: "rgba(255,255,255,0.18)" }}>
                No log output yet - run a channel to see activity here.
              </div>
            ) : (
              filteredLogs.map((entry) => (
                <div key={entry.id} className="flex gap-2 px-4 items-baseline">
                  <span className="flex-shrink-0 select-none tabular-nums" style={{ color: "rgba(255,255,255,0.22)", width: 60 }}>
                    {fmtTime(entry.ts)}
                  </span>
                  <span className="flex-shrink-0" style={{ color: "rgba(165,182,214,0.45)", width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.channelId !== null ? `[${entry.channelLabel}]` : ""}
                  </span>
                  <span style={{ color: LOG_LEVEL_COLOR[entry.level] }}>
                    {entry.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingChannel && (
        <ChannelEditModal
          channel={editingChannel}
          project={project}
          onSaved={handleSaved}
          onClose={() => setEditingChannel(null)}
        />
      )}

    </div>
  );
}

// ── CostBadge ────────────────────────────────────────────────────────────────

// ── PipelineStatus ────────────────────────────────────────────────────────────

type ProcessStats = {
  found?: number;
  droppedShort?: number;
  droppedDupe?: number;
  droppedStale?: number;
  droppedNoise?: number;
  prescored?: number;
  opportunities?: number;
};

function StepChip({ step, isFirst, arrow, fmt, active, na, dim, drop }: {
  step: { key: string; label: string; tip: string; value: number | undefined; sub?: string; color?: string };
  isFirst: boolean;
  arrow: React.ReactNode;
  fmt: (n: number | undefined) => string;
  active: string; na: string; dim: string; drop: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
      {!isFirst && arrow}
      <span className="text-sm" style={{ color: step.value !== undefined ? (step.color ?? active) : na }}>
        {fmt(step.value)}
      </span>
      <span
        title={step.tip}
        className="text-sm"
        style={{ color: dim, cursor: "default", borderBottom: "1px dotted rgba(255,255,255,0.2)" }}
      >
        {step.label}
      </span>
      {step.sub && <span style={{ color: drop }}>{step.sub}</span>}
    </span>
  );
}

function PipelineStatus({ scraped, running, stats, lastRunAt }: {
  scraped: number;
  running: boolean;
  stats: ProcessStats;
  lastRunAt?: Date;
}) {
  const fmt = (n: number | undefined) => n !== undefined ? n.toLocaleString() : "-";
  const hasData = scraped > 0 || stats.found !== undefined;

  const dim = "rgba(255,255,255,0.45)";
  const na = "rgba(255,255,255,0.3)";
  const active = "rgba(255,255,255,0.85)";
  const accent = "var(--accent)";
  const drop = "rgba(239,68,68,0.9)";
  const arrow = <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 5px" }}>→</span>;

  // Derived counts - only when we have the base value
  const afterLength = stats.found !== undefined
    ? stats.found - (stats.droppedShort ?? 0) : undefined;
  const afterDedup = afterLength !== undefined
    ? afterLength - (stats.droppedDupe ?? 0) : undefined;
  const afterStale = afterDedup !== undefined
    ? afterDedup - (stats.droppedStale ?? 0) : undefined;

  type Step = { key: string; label: string; tip: string; value: number | undefined; sub?: string; color?: string };
  const steps: Step[] = [
    {
      key: "scraped", label: "scraped", value: scraped || undefined,
      color: scraped > 0 ? (running ? accent : "rgba(0,255,136,0.7)") : undefined,
      tip: "Signals saved to the database after passing the pain-phrase filter (hasPain). Each scraper logs 'N new' per keyword - those counts sum up here.",
    },
    {
      key: "queued", label: "in queue", value: stats.found,
      tip: "Unprocessed signals waiting in the database. Signals already processed in a previous run are excluded - only new ones from this scrape are clustered.",
    },
    {
      key: "length", label: "≥80 chars", value: afterLength,
      sub: stats.droppedShort ? `−${stats.droppedShort.toLocaleString()}` : undefined,
      tip: "Signals shorter than 80 characters are dropped - too little text for the AI to reason about. Short snippets like 'X is broken' give clustering nothing to work with.",
    },
    {
      key: "dedup", label: "deduped", value: afterDedup,
      sub: stats.droppedDupe ? `−${stats.droppedDupe.toLocaleString()}` : undefined,
      tip: "Near-identical signals are deduplicated by text fingerprint (first 120 chars, normalised). The same post scraped twice or a near-copy only counts once.",
    },
    {
      key: "fresh", label: "fresh", value: afterStale,
      sub: stats.droppedStale ? `−${stats.droppedStale.toLocaleString()}` : undefined,
      tip: "Signals older than 365 days are dropped. Chronic pain from years ago likely already has solutions - fresher signals indicate active, unsolved problems.",
    },
    {
      key: "scored", label: "AI scored", value: stats.prescored,
      sub: stats.droppedNoise ? `−${stats.droppedNoise.toLocaleString()}` : undefined,
      tip: "Each signal is scored 1–5 by a fast AI model. Score 1 (solution launches, off-topic, hobbyist context) is dropped. Score 2+ proceeds to clustering. Signals about a specific tool, workflow, or dollar amount score highest.",
    },
    {
      key: "opps", label: "opps", value: stats.opportunities,
      color: stats.opportunities !== undefined ? (stats.opportunities > 0 ? accent : dim) : undefined,
      tip: "Opportunities created or updated. The AI clusters scored signals into themes, each cluster is scored 0–10 across 9 criteria (pain urgency, WTP, build simplicity…). Clusters scoring ≥ 4.0 become opportunities. Similar existing opportunities receive merged signals instead.",
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 0, overflow: "hidden", minWidth: 0 }}>
      <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 8px", flexShrink: 0 }}>|</span>
      {steps.map((step, i) => (
        <StepChip key={step.key} step={step} isFirst={i === 0} arrow={arrow} fmt={fmt} active={active} na={na} dim={dim} drop={drop} />
      ))}
      {running && (
        <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span style={{ display: "inline-block", animation: "bd-spin 0.9s linear infinite", width: 7, height: 7, border: "1.5px solid transparent", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
        </span>
      )}
      {!running && lastRunAt && (
        <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
          · {formatRunTime(lastRunAt)}
        </span>
      )}
    </div>
  );
}

// ── RateLimitBadge ────────────────────────────────────────────────────────────

function RateLimitBadge({ type }: { type: ChannelType }) {
  const rl = CHANNEL_RATE_LIMITS[type];

  if (!rl) return <span className="text-xs text-fg-subtle">-</span>;

  return (
    <span
      title={`${rl.label} - ${rl.note}`}
      style={{
        color: "var(--fg-muted)",
        borderBottom: "1px dotted var(--border-strong)",
        cursor: "default",
      }}
    >
      {rl.label}
    </span>
  );
}

function CostBadge({ cost }: { cost: ChannelCost | undefined }) {
  const colors: Record<ChannelCost, { bg: string; fg: string }> = {
    free: { bg: "rgba(34,197,94,0.1)", fg: "rgba(34,197,94,0.7)" },
    key: { bg: "rgba(251,191,36,0.1)", fg: "rgba(251,191,36,0.8)" },
    paid: { bg: "rgba(239,68,68,0.12)", fg: "rgba(239,68,68,0.8)" },
  };
  if (!cost || !colors[cost]) return null;
  const { bg, fg } = colors[cost];
  return (
    <span
      className="text-[0.60rem] font-semibold tracking-widest uppercase leading-none px-[5px] py-[2px] rounded-[3px] flex-shrink-0"
      style={{ background: bg, color: fg }}
    >
      {CHANNEL_COST_LABEL[cost]}
    </span>
  );
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ isActive, isRunning, isScrapeComplete }: {
  isActive: boolean;
  isRunning: boolean;
  isScrapeComplete: boolean; // scraper done, process.ts still running
}) {
  if (isRunning && !isScrapeComplete) {
    // Amber spinner - actively scraping
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "block", animation: "bd-spin 0.8s linear infinite" }}>
        <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="2" />
        <path d="M7 2 A5 5 0 0 1 12 7" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (isRunning && isScrapeComplete) {
    // Slow blue pulse - scrape done, waiting for process.ts
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "block", animation: "bd-spin 1.8s linear infinite" }}>
        <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(96,165,250,0.2)" strokeWidth="2" />
        <path d="M7 2 A5 5 0 0 1 12 7" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (!isActive) {
    return <span className="block w-[7px] h-[7px] rounded-full" style={{ background: "rgba(165,182,214,0.2)" }} />;
  }
  return <span className="block w-[7px] h-[7px] rounded-full bg-accent" />;
}

// ── RowIconBtn ────────────────────────────────────────────────────────────────

function RowIconBtn({
  icon, title, disabled, onClick, accent, danger,
}: {
  icon: React.ReactNode;
  title: string;
  disabled: boolean;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const hoverColor = danger ? "#ef4444" : accent ? "var(--accent)" : "var(--fg)";
  return (
    <Button
      variant="ghost"
      size="sm"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 26, height: 26, padding: 0,
        color: "var(--fg-subtle)",
        flexShrink: 0,
      }}
    >
      {icon}
    </Button>
  );
}

// ── KeywordPreview (read-only) ────────────────────────────────────────────────

function KeywordPreview({ items, prefix, accentColor }: { items: string[]; prefix?: string; accentColor?: boolean }) {
  if (items.length === 0) return <span className="text-sm text-fg-subtle">-</span>;
  const shown = items.slice(0, 4);
  const rest = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-[5px] items-center">
      {shown.map((item) => (
        <span
          key={item}
          className="px-2 py-[2px] text-xs border border-border-strong rounded-[var(--radius)] leading-[1.5]"
          style={{ color: accentColor ? "var(--accent)" : "var(--fg-muted)" }}
        >
          {prefix ? `${prefix}${item}` : item}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-xs text-fg-subtle">+{rest}</span>
      )}
    </div>
  );
}


// ── EditableChipList ──────────────────────────────────────────────────────────

function EditableChipList({
  items, onChange, placeholder, prefix,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  prefix?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  function commit() {
    const val = inputVal.trim().replace(/^r\//, "");
    if (val && !items.includes(val)) onChange([...items, val]);
    setInputVal("");
    setAdding(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setInputVal(""); setAdding(false); }
    if (e.key === "Tab") { e.preventDefault(); commit(); }
  }

  return (
    <div className="flex flex-wrap gap-[6px] items-center">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 py-[3px] pl-[10px] pr-[6px] text-sm border border-border-strong rounded-[var(--radius)] text-fg-muted leading-[1.5]"
          style={{ background: "rgba(165,182,214,0.04)" }}
        >
          {prefix ? `${prefix}${item}` : item}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((i) => i !== item))}
            style={{ color: "var(--fg-subtle)", height: "auto", padding: 0, lineHeight: 1 }}
          >
            <X size={10} />
          </Button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={placeholder}
          style={{
            height: 26, padding: "0 8px", fontFamily: "inherit",
            background: "transparent", border: "1px solid var(--accent)",
            borderRadius: "var(--radius)", color: "var(--fg)", outline: "none", minWidth: 140,
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          style={{
            gap: 4, padding: "3px 8px",
            border: "1px dashed var(--border-strong)",
            color: "var(--fg-subtle)", height: "auto", lineHeight: 1.5,
          }}
        >
          <Plus size={9} /> Add
        </Button>
      )}
    </div>
  );
}

// ── ChannelEditModal ──────────────────────────────────────────────────────────

function ChannelEditModal({
  channel, project, onSaved, onClose,
}: {
  channel: Channel;
  project: Project;
  onSaved: (channelId: number, keywords: string[], subreddits: string[], competitors: string[]) => void;
  onClose: () => void;
}) {
  const initial = configOf(channel);
  const [keywords, setKeywords] = useState(initial.keywords);
  const [subreddits, setSubreddits] = useState(initial.subreddits);
  const [competitors, setCompetitors] = useState(initial.competitors ?? []);
  const [prompt, setPrompt] = useState(() =>
    channelEditPrompt(project.name, project.hypothesis, CHANNEL_LABELS[channel.type as ChannelType] ?? channel.type, channel.type, initial.keywords, initial.subreddits)
  );
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<{ keywords: string[]; subreddits: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [discoveringSubreddits, setDiscoveringSubreddits] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [subredditSuggestions, setSubredditSuggestions] = useState<Array<{ name: string; subscribers: number; description: string }>>([]);
  const isReddit = channel.type === "reddit";
  const [descExpanded, setDescExpanded] = useState(false);
  const desc = CHANNEL_DESCRIPTIONS[channel.type as ChannelType] ?? null;
  const PREVIEW_LEN = 80;

  function addSuggestion(field: "keywords" | "subreddits", value: string) {
    if (field === "keywords") setKeywords((k) => k.includes(value) ? k : [...k, value]);
    else setSubreddits((s) => s.includes(value) ? s : [...s, value]);
    setSuggestions((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: prev[field].filter((v) => v !== value) };
    });
  }

  function addSubredditSuggestion(name: string) {
    setSubreddits((s) => s.includes(name) ? s : [...s, name]);
    setSubredditSuggestions((prev) => prev.filter((r) => r.name !== name));
  }

  function formatSubscribers(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  async function handleDiscoverSubreddits() {
    setDiscoveringSubreddits(true);
    setSubredditSuggestions([]);
    // Priority: typed query → channel keywords → project hypothesis/name (last resort)
    const fallback = (project.hypothesis ?? project.name ?? "")
      .split(/\s+/).slice(0, 4).join(" ");
    const searchKeywords = discoverQuery.trim()
      ? [discoverQuery.trim()]
      : keywords.length > 0
        ? keywords.slice(0, 3)
        : fallback ? [fallback] : [];
    try {
      const results = await discoverSubreddits({
        data: {
          keywords: searchKeywords,
          extraKeywords: keywords,
          projectName: project.name,
          existingSubreddits: subreddits,
        },
      });
      setSubredditSuggestions(results.filter((r) => !subreddits.includes(r.name)));
    } finally {
      setDiscoveringSubreddits(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setSuggestions(null);
    try {
      const result = await generateFromCustomPrompt({ data: { prompt } });
      const newKws = result.keywords.filter((k) => !keywords.includes(k));
      const newSubs = result.subreddits.filter((s) => !subreddits.includes(s));
      setSuggestions({ keywords: newKws, subreddits: newSubs });
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateChannelConfig({ data: { channelId: channel.id, keywords, subreddits, competitors } });
      onSaved(channel.id, keywords, subreddits, competitors);
    } finally {
      setSaving(false);
    }
  }

  function onOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const hasSuggestions = suggestions && (suggestions.keywords.length > 0 || suggestions.subreddits.length > 0);
  const hasSubredditSuggestions = subredditSuggestions.length > 0;

  return createPortal(
    <div
      onClick={onOverlayClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div
        className="flex flex-col overflow-hidden border border-border-strong rounded-[var(--radius)]"
        style={{
          width: 580, maxHeight: "85vh",
          background: "var(--bg-elevated)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >

        {/* Header */}
        <div className="px-5 py-[14px] border-b border-border flex-shrink-0">
          <div
            className="flex items-center gap-[10px]"
            style={{ marginBottom: desc ? 8 : 0 }}
          >
            <ChannelIcon type={channel.type as ChannelType} size={14} style={{ color: "var(--fg-muted)" }} />
            <span className="text-base font-semibold text-fg flex-1">
              {CHANNEL_LABELS[channel.type as ChannelType]}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              style={{ color: "var(--fg-subtle)", height: "auto", padding: 4 }}
            >
              <X size={14} />
            </Button>
          </div>
          {desc && (
            <p className="m-0 text-sm text-fg-subtle leading-[1.55]">
              {descExpanded ? desc : `${desc.slice(0, PREVIEW_LEN)}${desc.length > PREVIEW_LEN ? "…" : ""}`}
              {desc.length > PREVIEW_LEN && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", fontSize: "0.74rem", padding: 0, fontFamily: "inherit" }}
                >
                  {descExpanded ? "show less" : "show more"}
                </button>
              )}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Keywords */}
          <div className="mb-5">
            <span style={SECTION_LABEL_STYLE}>Keywords</span>
            <EditableChipList items={keywords} onChange={setKeywords} placeholder="Add keyword…" />
          </div>

          {/* Communities (Reddit only) */}
          {isReddit && (
            <div className="mb-5">
              <div className="mb-[10px]">
                <span style={{ ...SECTION_LABEL_STYLE, marginBottom: 8, display: "block" }}>Communities</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={e => setDiscoverQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleDiscoverSubreddits(); }}
                    placeholder="e.g. AI agents, browser automation, web scraping…"
                    style={{
                      flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.80rem",
                      padding: "6px 10px", fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscoverSubreddits}
                    disabled={discoveringSubreddits}
                    style={{
                      gap: 5, flexShrink: 0,
                      border: "1px solid rgba(0,255,136,0.25)",
                      color: "rgba(0,255,136,0.7)",
                      fontSize: "0.72rem",
                    }}
                  >
                    {discoveringSubreddits ? (
                      <><span style={{ display: "inline-block", animation: "bd-spin 0.9s linear infinite", width: 8, height: 8, border: "1.5px solid transparent", borderTopColor: "var(--accent)", borderRadius: "50%" }} />Searching…</>
                    ) : (
                      <><Sparkles size={9} />Search</>
                    )}
                  </Button>
                </div>
                <p style={{ margin: "5px 0 0", fontSize: "0.68rem", color: "rgba(165,182,214,0.3)", lineHeight: 1.4 }}>
                  Search Reddit communities directly - same as reddit.com/subreddits/search.
                </p>
              </div>
              <EditableChipList items={subreddits} onChange={setSubreddits} placeholder="Add subreddit…" prefix="r/" />

              {/* Subreddit discovery suggestions */}
              {hasSubredditSuggestions && (
                <div
                  className="mt-3 px-4 py-[12px] rounded-[var(--radius)]"
                  style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.15)" }}
                >
                  <span style={{ ...SECTION_LABEL_STYLE, color: "var(--accent)", opacity: 0.8, marginBottom: 10 }}>
                    Discovered communities - click to add
                  </span>
                  <div className="flex flex-wrap gap-[6px]">
                    {subredditSuggestions.map((r) => (
                      <SuggestionChip
                        key={r.name}
                        label={r.subscribers > 0 ? `r/${r.name} · ${formatSubscribers(r.subscribers)}` : `r/${r.name}`}
                        onClick={() => addSubredditSuggestion(r.name)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deep Scan (Reddit only) */}
          {isReddit && (
            <DeepScanSection channelId={channel.id} subreddits={subreddits} />
          )}

          {/* Competitors (all channel types) */}
          <div className="mb-5">
            <span style={SECTION_LABEL_STYLE}>Competitors</span>
            <p className="m-0 text-xs text-fg-subtle mb-[10px]" style={{ lineHeight: 1.55 }}>
              Products your target users complain about or switch away from. Scrapers will search for gaps and complaints about these tools.
            </p>
            <EditableChipList items={competitors} onChange={setCompetitors} placeholder="Add competitor…" />
          </div>

          {/* Divider */}
          <div className="border-t border-border flex items-center gap-[10px]" style={{ margin: "24px 0 20px" }}>
            <span style={{ ...SECTION_LABEL_STYLE, marginBottom: 0, whiteSpace: "nowrap", paddingTop: 12 }}>
              Generate with AI
            </span>
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={9}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px", fontSize: "0.80rem", fontFamily: "inherit",
              lineHeight: 1.65, color: "var(--fg-muted)",
              background: "rgba(165,182,214,0.03)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)",
              resize: "vertical", outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(165,182,214,0.3)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
          />

          <div className="mt-[10px]">
            <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <span className="flex items-center gap-[6px]">
                  <Sparkles size={11} style={{ opacity: 0.6 }} /> Generating…
                </span>
              ) : (
                <span className="flex items-center gap-[6px]">
                  <Sparkles size={11} /> Generate suggestions
                </span>
              )}
            </Button>
          </div>

          {/* Suggestions */}
          {hasSuggestions && (
            <div
              className="mt-[18px] px-4 py-[14px] rounded-[var(--radius)]"
              style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.15)" }}
            >
              <span style={{ ...SECTION_LABEL_STYLE, color: "var(--accent)", opacity: 0.8 }}>Suggestions - click to add</span>

              {suggestions!.keywords.length > 0 && (
                <div style={{ marginBottom: isReddit && suggestions!.subreddits.length > 0 ? 12 : 0 }}>
                  <div className="flex flex-wrap gap-[6px]">
                    {suggestions!.keywords.map((k) => (
                      <SuggestionChip key={k} label={k} onClick={() => addSuggestion("keywords", k)} />
                    ))}
                  </div>
                </div>
              )}

              {isReddit && suggestions!.subreddits.length > 0 && (
                <div>
                  <span style={{ ...SECTION_LABEL_STYLE, marginBottom: 8 }}>Communities</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {suggestions!.subreddits.map((s) => (
                      <SuggestionChip key={s} label={`r/${s}`} onClick={() => addSuggestion("subreddits", s)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border flex-shrink-0">
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}

// ── DeepScanSection ───────────────────────────────────────────────────────────

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color =
    value >= 7 ? "#00ff88"
      : value >= 4 ? "#f59e0b"
        : "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span
        style={{
          fontSize: "1.4rem", fontWeight: 700, lineHeight: 1,
          color, fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: "0.65rem", color: "var(--fg-subtle)", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

function DeepScanSection({ channelId, subreddits }: { channelId: number; subreddits: string[] }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [profile, setProfile] = useState<ChannelProfileData | null>(null);
  const [subredditLabel, setSubredditLabel] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [profileExpanded, setProfileExpanded] = useState(false);

  // Load initial state
  useEffect(() => {
    let cancelled = false;
    getChannelProfile({ data: { channelId } }).then((result) => {
      if (cancelled) return;
      if (result?.profile) {
        setProfile(result.profile.profileJson);
        setSubredditLabel(result.profile.subreddit ?? "");
      }
      if (result?.channel) {
        setStatus((result.channel.deepScanStatus as "idle" | "running" | "done" | "failed") ?? "idle");
        setProgress(result.channel.deepScanProgress ?? 0);
        setLastScanAt(result.channel.lastDeepScanAt ?? null);
        if (result.channel.deepScanStatus === "running") {
          startPolling();
        }
      }
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [channelId]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const result = await getChannelScanStatus({ data: { channelId } });
        if (!result) return;
        const s = (result.deepScanStatus ?? "idle") as "idle" | "running" | "done" | "failed";
        setStatus(s);
        setProgress(result.deepScanProgress ?? 0);
        if (result.lastDeepScanAt) setLastScanAt(result.lastDeepScanAt);

        if (s !== "running") {
          stopPolling();
          setScanning(false);
          // Load the newly generated profile
          if (s === "done") {
            const profileResult = await getChannelProfile({ data: { channelId } });
            if (profileResult?.profile) {
              setProfile(profileResult.profile.profileJson);
              setSubredditLabel(profileResult.profile.subreddit ?? "");
            }
          }
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  async function handleRunDeepScan() {
    setScanning(true);
    setStatus("running");
    setProgress(0);
    setProfile(null);
    try {
      await triggerDeepScan({ data: { channelId, lookbackDays: 365 } });
      startPolling();
    } catch {
      setScanning(false);
      setStatus("failed");
    }
  }

  const isRunning = status === "running" || scanning;
  const hasSubs = subreddits.length > 0;

  return (
    <div className="mb-5">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={SECTION_LABEL_STYLE}>Deep Scan</span>
        {lastScanAt && (
          <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)" }}>
            Last: {new Date(lastScanAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <p className="m-0 text-xs text-fg-subtle mb-[10px]" style={{ lineHeight: 1.55 }}>
        Fetches up to 2,000 posts from the last 365 days across your configured subreddits, scores authenticity, and generates a community profile.
      </p>

      {/* Run button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRunDeepScan}
        disabled={isRunning || !hasSubs}
        style={{
          gap: 5,
          border: "1px solid rgba(0,255,136,0.25)",
          color: isRunning ? "var(--fg-subtle)" : "rgba(0,255,136,0.7)",
          fontSize: "0.72rem",
          marginBottom: 10,
        }}
      >
        {isRunning ? (
          <>
            <span style={{
              display: "inline-block", animation: "bd-spin 0.9s linear infinite",
              width: 8, height: 8,
              border: "1.5px solid transparent", borderTopColor: "var(--accent)", borderRadius: "50%",
            }} />
            Scanning… {progress > 0 ? `${progress}%` : ""}
          </>
        ) : (
          <>
            <Sparkles size={9} />
            Run Deep Scan (365 days)
          </>
        )}
      </Button>

      {/* Progress bar */}
      {isRunning && (
        <div style={{
          height: 4, background: "rgba(165,182,214,0.08)",
          borderRadius: 2, marginBottom: 10, overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--accent)",
            borderRadius: 2,
            transition: "width 0.5s ease",
          }} />
        </div>
      )}

      {/* Status indicator when failed */}
      {status === "failed" && !isRunning && (
        <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: "0 0 8px" }}>
          Scan failed. Check server logs. Retry when ready.
        </p>
      )}

      {/* Profile display */}
      {profile && status !== "running" && (
        <div
          style={{
            background: "rgba(0,255,136,0.03)",
            border: "1px solid rgba(0,255,136,0.15)",
            borderRadius: "var(--radius)",
            padding: "14px 16px",
          }}
        >
          {subredditLabel && (
            <div style={{ fontSize: "0.70rem", color: "var(--accent)", marginBottom: 10, opacity: 0.7 }}>
              r/{subredditLabel}
            </div>
          )}

          {/* Score trio */}
          <div style={{ display: "flex", gap: 20, marginBottom: 14, justifyContent: "center" }}>
            <ScoreBadge label="Openness" value={profile.opennessScore} />
            <ScoreBadge label="Pain Density" value={profile.painDensityScore} />
            <ScoreBadge label="Purchase Intent" value={profile.purchaseIntentScore} />
          </div>

          {/* Top pain themes */}
          {profile.topPainThemes && profile.topPainThemes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 6, color: "var(--fg-muted)" }}>Top pain themes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {profile.topPainThemes.slice(0, 5).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--fg)", flex: 1 }}>{t.theme}</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
                      auth {t.avgAuthenticity.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distribution playbook */}
          <div>
            <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 6, color: "var(--fg-muted)" }}>Distribution playbook</div>
            <div
              style={{
                fontSize: "0.75rem", color: "var(--fg-muted)",
                whiteSpace: "pre-wrap", lineHeight: 1.6,
                maxHeight: profileExpanded ? "none" : 120,
                overflow: "hidden",
                maskImage: profileExpanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)",
                WebkitMaskImage: profileExpanded ? "none" : "linear-gradient(to bottom, black 60%, transparent 100%)",
              }}
            >
              {profile.distributionPlaybook}
            </div>
            <button
              onClick={() => setProfileExpanded((v) => !v)}
              style={{
                marginTop: 4, background: "none", border: "none", cursor: "pointer",
                color: "var(--fg-subtle)", fontSize: "0.68rem", padding: 0, fontFamily: "inherit",
              }}
            >
              {profileExpanded ? "show less" : "show more"}
            </button>
          </div>
        </div>
      )}

      {/* Divider at bottom */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 20 }} />
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      style={{
        padding: "3px 10px", fontSize: "0.78rem",
        border: "1px solid rgba(0,255,136,0.3)",
        color: "var(--fg-muted)", height: "auto", lineHeight: 1.5,
      }}
    >
      + {label}
    </Button>
  );
}

// ── Channel descriptions ──────────────────────────────────────────────────────

const CHANNEL_DESCRIPTIONS: Partial<Record<ChannelType, string>> = {
  reddit: "Searches Reddit posts and comments via Pushshift / Reddit API. Finds organic discussions where users mention your keywords inside specific subreddits. Returns post titles, comment text, upvote counts, and direct links.",
  hn: "Scrapes Hacker News posts and comments via the Algolia search API. Targets submissions and threads mentioning your keywords. Best for developer and founder audiences. Returns post titles, scores, and comment excerpts.",
  twitter: "Queries the Twitter/X API (or xAI API) for recent tweets mentioning your keywords. Captures real-time complaints, questions, and product discussions. Requires an API key. Returns tweet text, author handle, and engagement counts.",
  bluesky: "Searches the Bluesky decentralized network via the AT Protocol API. Finds posts from the tech-forward, privacy-conscious crowd migrating away from Twitter. Requires a Bluesky app password configured in settings.",
  youtube: "Queries the YouTube Data API for videos, titles, descriptions, and comment sections related to your keywords. Surfaces demand from tutorial seekers and product reviewers. Requires a free YouTube API key.",
  podcast: "Searches the Podcast Index - an open directory of 4M+ shows - for episodes covering your keyword topics. Identifies thought leaders and niche audience signals buried in audio content. Requires Podcast Index API credentials.",
  trustpilot: "Scrapes Trustpilot company reviews via the DataForSEO API. Mines negative reviews for unmet needs, billing complaints, and switching-intent signals from frustrated customers. Billed per request through DataForSEO.",
  producthunt: "Uses the Product Hunt GraphQL API to search launches, upvote counts, and hunter comments. Identifies what buyers are actively hunting and what gaps they flag in product reviews. Requires a free PH API token.",
  stackoverflow: "Searches Stack Overflow questions and answers via the Stack Exchange API. Surfaces developers asking how to solve a problem your product could automate. Free and rate-limited by IP.",
  github: "Searches GitHub issues, repo discussions, and README files via the GitHub REST API. Finds developer pain points, repeated feature requests, and tool gaps in open-source repos. Token optional but raises rate limits.",
  devto: "Searches dev.to articles and comments via its public API. Finds developer community writing and discussion threads around your keywords. Free with no key required.",
  mastodon: "Searches the Mastodon federated network for public posts mentioning your keywords via instance search APIs. Targets privacy-conscious and open-source audiences.",
  indie_hackers: "Scrapes Indie Hackers posts, founder interviews, and group discussions. Ideal for surfacing solopreneur pain points, tool-stack recommendations, and revenue signals from bootstrapped builders.",
  lobsters: "Searches Lobsters (lobste.rs) - a curated, invite-only link aggregator for programmers. High signal-to-noise ratio for niche developer topics. No API key needed.",

  community: "Searches miscellaneous web forums and niche communities not covered by the specialized channels. Acts as a catch-all for smaller forums, Discord exports, and long-tail community sites.",
  jobs: "Searches general job boards (Indeed, LinkedIn, etc.) for roles related to your keywords. Identifies companies hiring people to solve the exact problem your product automates.",
  firefox: "Scrapes the Firefox Add-ons marketplace for browser extensions matching your keywords. Surfaces existing user demand, review complaints, and install counts for browser-based tools.",
  edgar: "Searches SEC EDGAR filings (10-K, 10-Q, 8-K) for companies mentioning your keywords. Surfaces enterprise adoption signals and regulatory compliance pain points in public disclosures.",
  regulatory: "Searches regulatory databases and compliance documents for your keywords. Identifies industries where regulatory burden or new rules are creating fresh software opportunities.",
  lemmy: "Searches Lemmy - a federated, open-source Reddit alternative. Queries lemmy.world, lemmy.ml, and beehaw.org simultaneously. Many niche technical communities with candid pain-point discussions. Free, no key needed.",
};

// ── Style constants ───────────────────────────────────────────────────────────

const LOG_LEVEL_COLOR: Record<LogLevel, string> = {
  info: "rgba(165,182,214,0.65)",
  success: "#00ff88",
  error: "#ef4444",
  warn: "#fbbf24",
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--fg-subtle)",
  display: "block", marginBottom: 10,
};

function TH(opts: { width?: number }): React.CSSProperties {
  return {
    padding: "10px 20px", textAlign: "left",
    fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase", color: "var(--fg-subtle)",
    width: opts.width, whiteSpace: "nowrap",
  };
}
