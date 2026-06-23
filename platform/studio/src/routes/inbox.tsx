import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Zap, Clock } from "lucide-react";
import { getGlobalQueue } from "~/lib/distribution-fns";
import {
  InboxCtx, ENTRY_COLOR, PLATFORM_CFG, pc,
  type ReviewItem, type GenerateItem, type Entry, type Folder,
} from "~/lib/inbox-ctx";

export { InboxCtx } from "~/lib/inbox-ctx";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/inbox")({
  loader: async () => getGlobalQueue(),
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: InboxLayout,
});

function fmtTime(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Folder item (sidebar nav) ─────────────────────────────────────────────────

function FolderLink({ to, label, color, count, active }: {
  to: string; label: string; color: string; count: number; active: boolean;
}) {
  return (
    <Link to={to} style={{ textDecoration: "none", display: "block" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 14px",
        borderRadius: 6,
        background: active ? "rgba(255,255,255,0.07)" : "transparent",
        cursor: "pointer",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: count > 0 ? color : "rgba(165,182,214,0.18)",
          boxShadow: active && count > 0 ? `0 0 6px ${color}66` : "none",
        }} />
        <span style={{
          flex: 1,
          fontSize: "0.82rem",
          fontWeight: active ? 600 : 400,
          color: active ? "var(--fg)" : "rgba(165,182,214,0.5)",
        }}>
          {label}
        </span>
        {count > 0 && (
          <span style={{
            fontSize: "0.68rem", fontWeight: 700,
            padding: "1px 6px", borderRadius: 10,
            background: active ? `${color}20` : "rgba(255,255,255,0.05)",
            color: active ? color : "rgba(165,182,214,0.35)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {count}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Entry row (sidebar item list) ─────────────────────────────────────────────

function EntryRow({ entry, selected, onClick }: {
  entry: Entry; selected: boolean; onClick: () => void;
}) {
  const color = ENTRY_COLOR[entry.kind];
  const bg = selected ? "rgba(255,255,255,0.06)" : "transparent";

  if (entry.kind === "generate") {
    const { item } = entry;
    return (
      <button
        onClick={onClick}
        style={{
          width: "100%", display: "flex", padding: 0,
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
        <div style={{ width: 3, flexShrink: 0, background: selected ? color : "transparent", alignSelf: "stretch" }} />
        <div style={{ flex: 1, padding: "12px 14px", background: bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <Zap size={9} style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: "0.60rem", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em", textTransform: "uppercase" }}>Generate</span>
          </div>
          <div style={{ fontSize: "0.80rem", fontWeight: selected ? 500 : 400, color: selected ? "var(--fg)" : "var(--fg-muted)", lineHeight: 1.3, marginBottom: 2 }}>
            {item.playbookName}
          </div>
          <div style={{ fontSize: "0.69rem", color: "rgba(165,182,214,0.38)" }}>{item.projectName}</div>
        </div>
      </button>
    );
  }

  const { item } = entry;
  const platform = pc(item.platform);
  const preview = item.title || item.content.slice(0, 80);
  const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", padding: 0,
        background: "none", border: "none", cursor: "pointer",
        fontFamily: "inherit", textAlign: "left",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
      <div style={{ width: 3, flexShrink: 0, background: selected ? color : "transparent", alignSelf: "stretch" }} />
      <div style={{ flex: 1, padding: "12px 14px", background: bg }}>
        {/* Platform + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: "0.58rem", fontWeight: 700,
            padding: "1px 5px", borderRadius: 3,
            color: platform.color, background: `${platform.color}15`,
            border: `1px solid ${platform.color}28`,
            letterSpacing: "0.04em", whiteSpace: "nowrap",
          }}>
            {platform.label}
          </span>
          {entry.kind === "post" && scheduledAt && (
            <span style={{ fontSize: "0.59rem", color: "#a78bfa", display: "flex", alignItems: "center", gap: 2 }}>
              <Clock size={9} />
              {scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.28)", whiteSpace: "nowrap" }}>
            {fmtTime(item.createdAt)}
          </span>
        </div>
        {/* Project (sender) */}
        <div style={{ fontSize: "0.76rem", fontWeight: 600, color: selected ? "var(--fg)" : "var(--fg-muted)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.projectName}
        </div>
        {/* Preview */}
        <div style={{
          fontSize: "0.72rem", color: "rgba(165,182,214,0.4)", lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {preview}
        </div>
      </div>
    </button>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

function InboxLayout() {
  const data = Route.useLoaderData() as {
    toReview: ReviewItem[];
    toPost: ReviewItem[];
    toGenerate: GenerateItem[];
  };

  const [postItems, setPostItems] = useState(data.toPost);
  const [reviewItems, setReviewItems] = useState(data.toReview);
  const [generateItems, setGenerateItems] = useState(data.toGenerate);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const location = useRouterState({ select: s => s.location.pathname });

  const activeFolder: Folder =
    location.endsWith("/post") ? "post"
      : location.endsWith("/review") ? "review"
        : location.endsWith("/generate") ? "generate"
          : "all";

  const allEntries: Entry[] = [
    ...postItems.map(item => ({ kind: "post" as const, id: `post-${item.id}`, item })),
    ...reviewItems.map(item => ({ kind: "review" as const, id: `review-${item.id}`, item })),
    ...generateItems.map(item => ({ kind: "generate" as const, id: `gen-${item.projectId}-${item.playbookId}`, item })),
  ];

  const folderEntries: Entry[] =
    activeFolder === "all" ? allEntries
      : activeFolder === "post" ? allEntries.filter(e => e.kind === "post")
        : activeFolder === "review" ? allEntries.filter(e => e.kind === "review")
          : allEntries.filter(e => e.kind === "generate");

  // Auto-select first item when folder changes or items update
  useEffect(() => {
    const exists = folderEntries.find(e => e.id === selectedId);
    if (!exists) setSelectedId(folderEntries[0]?.id ?? null);
  }, [activeFolder, folderEntries.length]);

  function removeEntry(id: string) {
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;
    if (entry.kind === "post") setPostItems(p => p.filter(i => `post-${i.id}` !== id));
    if (entry.kind === "review") setReviewItems(p => p.filter(i => `review-${i.id}` !== id));
    if (entry.kind === "generate") setGenerateItems(p => p.filter(i => `gen-${i.projectId}-${i.playbookId}` !== id));
    const idx = folderEntries.findIndex(e => e.id === id);
    const next = folderEntries[idx + 1] ?? folderEntries[idx - 1];
    setSelectedId(next?.id ?? null);
  }

  const reloadQueue = useCallback(async () => {
    const fresh = await getGlobalQueue();
    setPostItems(fresh.toPost as ReviewItem[]);
    setReviewItems(fresh.toReview as ReviewItem[]);
    setGenerateItems(fresh.toGenerate as GenerateItem[]);
  }, []);

  const counts = {
    all: allEntries.length,
    post: postItems.length,
    review: reviewItems.length,
    generate: generateItems.length,
  };

  const FOLDERS: { folder: Folder; to: string; label: string; color: string }[] = [
    { folder: "all", to: "/inbox", label: "All", color: "var(--fg)" },
    { folder: "post", to: "/inbox/post", label: "Post today", color: "#a78bfa" },
    { folder: "review", to: "/inbox/review", label: "Review", color: "#22c55e" },
    { folder: "generate", to: "/inbox/generate", label: "Generate", color: "#f59e0b" },
  ];

  return (
    <InboxCtx.Provider value={{ allEntries, folderEntries, selectedId, setSelectedId, removeEntry, reloadQueue }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left sidebar */}
        <div style={{
          width: 280, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.15)",
        }}>
          {/* Folder nav */}
          <div style={{ padding: "14px 10px 10px" }}>
            {FOLDERS.map(f => (
              <FolderLink
                key={f.folder}
                to={f.to}
                label={f.label}
                color={f.color}
                count={counts[f.folder]}
                active={activeFolder === f.folder}
              />
            ))}
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 10px 6px" }} />

          {/* Item list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {folderEntries.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(165,182,214,0.22)" }}>Nothing here</p>
              </div>
            ) : (
              folderEntries.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  selected={entry.id === selectedId}
                  onClick={() => setSelectedId(entry.id)}
                />
              ))
            )}
          </div>

          {/* Footer hint */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ margin: 0, fontSize: "0.60rem", color: "rgba(165,182,214,0.18)", letterSpacing: "0.04em" }}>
              j / k navigate · a approve · r skip · e edit
            </p>
          </div>
        </div>

        {/* Reading pane - child route renders here */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Outlet />
        </div>
      </div>
    </InboxCtx.Provider>
  );
}
