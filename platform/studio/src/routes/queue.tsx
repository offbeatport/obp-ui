import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Check, X, Zap, Copy, CheckCheck, Edit3, ExternalLink,
  Calendar, Clock, Send, RotateCcw,
} from "lucide-react";
import { getGlobalQueue, updateContentItem, generateCampaign } from "~/lib/distribution-fns";
import type { ContentItem } from "~/db/schema";

export const Route = createFileRoute("/queue")({
  loader: async () => getGlobalQueue(),
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: InboxPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewItem = ContentItem & { projectName: string; projectId: number };
type GenerateItem = {
  playbookId: number; playbookSlug: string; playbookName: string;
  instanceId: number; projectId: number; projectName: string;
};

type Entry =
  | { kind: "post"; id: string; item: ReviewItem }
  | { kind: "review"; id: string; item: ReviewItem }
  | { kind: "generate"; id: string; item: GenerateItem };

type Folder = "inbox" | "post" | "review" | "generate";

// ── Config ────────────────────────────────────────────────────────────────────

const FOLDER_CFG: Record<Folder, { label: string; color: string }> = {
  inbox: { label: "Inbox", color: "var(--fg)" },
  post: { label: "Post today", color: "#a78bfa" },
  review: { label: "Review", color: "#22c55e" },
  generate: { label: "Generate", color: "#f59e0b" },
};

const PLATFORM_CFG: Record<string, { label: string; color: string }> = {
  reddit: { label: "Reddit", color: "#ff4500" },
  hn: { label: "Hacker News", color: "#ff6600" },
  twitter: { label: "X / Twitter", color: "#1da1f2" },
  linkedin: { label: "LinkedIn", color: "#0077b5" },
  newsletter: { label: "Newsletter", color: "#a78bfa" },
  ph: { label: "Product Hunt", color: "#da552f" },
  youtube: { label: "YouTube", color: "#ff0000" },
  seo: { label: "SEO / AEO", color: "#22c55e" },
  bluesky: { label: "Bluesky", color: "#0085ff" },
};

const pc = (p: string) => PLATFORM_CFG[p] ?? { label: p, color: "rgba(165,182,214,0.5)" };

const ENTRY_COLOR: Record<Entry["kind"], string> = {
  post: "#a78bfa",
  review: "#22c55e",
  generate: "#f59e0b",
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy };
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return "";
  const now = new Date();
  const date = new Date(d);
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (daysDiff === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (daysDiff < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Left sidebar: folder nav ──────────────────────────────────────────────────

function FolderItem({ folder, active, label, color, count, onClick }: {
  folder: Folder; active: boolean; label: string; color: string; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "7px 16px",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        borderRadius: 6, marginBottom: 1,
      }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: count > 0 ? color : "rgba(165,182,214,0.2)",
      }} />
      <span style={{
        flex: 1, fontSize: "0.82rem",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--fg)" : "rgba(165,182,214,0.55)",
      }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{
          fontSize: "0.68rem", fontWeight: 700,
          padding: "1px 6px", borderRadius: 10,
          background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
          color: active ? color : "rgba(165,182,214,0.4)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Left sidebar: item row ────────────────────────────────────────────────────

function EntryRow({ entry, selected, onSelect }: {
  entry: Entry; selected: boolean; onSelect: () => void;
}) {
  const color = ENTRY_COLOR[entry.kind];

  if (entry.kind === "generate") {
    const { item } = entry;
    return (
      <button
        onClick={onSelect}
        style={{
          width: "100%", display: "flex", padding: "0", background: "none",
          border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
        {/* Left stripe */}
        <div style={{ width: 3, flexShrink: 0, background: selected ? color : "transparent", borderRadius: "0 0 0 0", alignSelf: "stretch" }} />
        <div style={{
          flex: 1, padding: "12px 14px",
          background: selected ? "rgba(255,255,255,0.05)" : "transparent",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: "0.60rem", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em", textTransform: "uppercase" }}>Generate</span>
            <span style={{ flex: 1 }} />
            <Zap size={10} style={{ color: "#f59e0b", opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: "0.80rem", fontWeight: 500, color: selected ? "var(--fg)" : "var(--fg-muted)", marginBottom: 2, lineHeight: 1.3 }}>
            {item.playbookName}
          </div>
          <div style={{ fontSize: "0.69rem", color: "rgba(165,182,214,0.4)" }}>
            {item.projectName}
          </div>
        </div>
      </button>
    );
  }

  const { item } = entry;
  const platform = pc(item.platform);
  const preview = item.title || item.content.slice(0, 90);
  const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%", display: "flex", padding: "0", background: "none",
        border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
      {/* Left stripe */}
      <div style={{ width: 3, flexShrink: 0, background: selected ? color : "transparent", alignSelf: "stretch" }} />
      <div style={{
        flex: 1, padding: "12px 14px",
        background: selected ? "rgba(255,255,255,0.05)" : "transparent",
      }}>

        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: "0.60rem", fontWeight: 700,
            padding: "1px 5px", borderRadius: 3,
            color: platform.color, background: `${platform.color}18`,
            border: `1px solid ${platform.color}30`,
            letterSpacing: "0.04em", whiteSpace: "nowrap",
          }}>
            {platform.label}
          </span>
          {entry.kind === "post" && scheduledAt && (
            <span style={{ fontSize: "0.60rem", color: "#a78bfa", display: "flex", alignItems: "center", gap: 2 }}>
              <Clock size={9} />
              {scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "0.64rem", color: "rgba(165,182,214,0.3)", whiteSpace: "nowrap" }}>
            {fmtTime(item.createdAt)}
          </span>
        </div>

        {/* Project name (like sender) */}
        <div style={{ fontSize: "0.76rem", fontWeight: 600, color: selected ? "var(--fg)" : "var(--fg-muted)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.projectName}
        </div>

        {/* Preview */}
        <div style={{
          fontSize: "0.73rem", color: "rgba(165,182,214,0.45)", lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {preview}
        </div>
      </div>
    </button>
  );
}

// ── Right panel: reading pane ─────────────────────────────────────────────────

function GeneratePane({ entry, onDone }: { entry: Extract<Entry, { kind: "generate" }>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { item } = entry;

  async function generate() {
    setBusy(true);
    try {
      await generateCampaign({ data: { productId: item.projectId, playbookId: item.playbookId, playbookSlug: item.playbookSlug, projectName: item.projectName } });
      setDone(true);
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px" }}>
        {/* Meta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 36 }}>
          <MetaRow label="Project" value={item.projectName} />
          <MetaRow label="Strategy" value={item.playbookName} />
          <MetaRow label="Action" value="Generate content" valueColor="#f59e0b" />
        </div>

        {/* Subject */}
        <h2 style={{ margin: "0 0 24px", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--fg)", lineHeight: 1.2 }}>
          {item.playbookName}
        </h2>

        <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(165,182,214,0.5)", lineHeight: 1.7 }}>
          No content has been generated for this strategy yet.
          Click Generate to create posts, articles, and other content pieces for{" "}
          <strong style={{ color: "var(--fg-muted)" }}>{item.projectName}</strong> using the{" "}
          <strong style={{ color: "var(--fg-muted)" }}>{item.playbookName}</strong> playbook.
          The generated content will appear in your Review queue.
        </p>

        {done && (
          <div style={{ marginTop: 24, padding: "14px 18px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, fontSize: "0.84rem", color: "#22c55e" }}>
            ✦ Content generated - check your Review queue.
          </div>
        )}
      </div>

      {/* Action bar */}
      <ActionBar>
        <ActionBtn
          onClick={generate}
          disabled={busy || done}
          primary
          color="#f59e0b"
          icon={<Zap size={14} />}>
          {busy ? "Generating…" : done ? "Generated ✓" : "Generate"}
        </ActionBtn>
        <Link to="/products/$id/distribution" params={{ id: String(item.projectId) }} style={{ textDecoration: "none" }}>
          <ActionBtn icon={<ExternalLink size={13} />} color="rgba(165,182,214,0.5)">Open project</ActionBtn>
        </Link>
      </ActionBar>
    </div>
  );
}

function ReviewPane({ entry, onApprove, onReject, onRemove }: {
  entry: Extract<Entry, { kind: "review" | "post" }>;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove: () => void;
}) {
  const { item } = entry;
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const [title, setTitle] = useState(item.title ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { copied, copy } = useCopy();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const platform = pc(item.platform);
  const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;
  const hasTitle = ["hn", "ph", "newsletter", "seo", "youtube"].includes(item.platform);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  async function approve() {
    setSaving(true);
    try {
      if (editing && content !== item.content) {
        await updateContentItem({ data: { id: item.id, content, title: title || null, status: "approved" } });
      } else {
        await updateContentItem({ data: { id: item.id, status: "approved" } });
      }
      setDone(true);
      onApprove?.();
      onRemove();
    } finally { setSaving(false); }
  }

  async function markPosted() {
    setSaving(true);
    try {
      await updateContentItem({ data: { id: item.id, status: "published", publishedAtMs: Date.now() } });
      setDone(true);
      onRemove();
    } finally { setSaving(false); }
  }

  async function reject() {
    await updateContentItem({ data: { id: item.id, status: "rejected" } });
    onReject?.();
    onRemove();
  }

  async function schedule() {
    const d = new Date();
    d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    await updateContentItem({ data: { id: item.id, status: "scheduled", scheduledAtMs: d.getTime() } });
    onRemove();
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px 24px" }}>

        {/* Meta header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <MetaRow label="Project" value={item.projectName} />
          <MetaRow label="Channel" value={platform.label} valueColor={platform.color} />
          {(item as any).playbookName && <MetaRow label="Via" value={(item as any).playbookName} />}
          {scheduledAt && entry.kind === "post" && (
            <MetaRow label="Scheduled" value={scheduledAt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} valueColor="#a78bfa" />
          )}
          <MetaRow label="Created" value={fmtTime(item.createdAt)} />
        </div>

        {/* Title */}
        {hasTitle && (
          editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Subject / title"
              style={{
                width: "100%", marginBottom: 20, background: "transparent", border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.12)", outline: "none",
                color: "var(--fg)", fontSize: "1.4rem", fontWeight: 700, fontFamily: "inherit",
                padding: "0 0 12px", letterSpacing: "-0.025em", boxSizing: "border-box",
              }}
            />
          ) : (
            title && (
              <h2 style={{ margin: "0 0 20px", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--fg)", lineHeight: 1.2 }}>
                {title}
              </h2>
            )
          )
        )}

        {/* Body */}
        {editing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{
              width: "100%", minHeight: 280, background: "transparent", border: "none",
              outline: "none", color: "var(--fg-muted)", fontFamily: "inherit",
              fontSize: "0.90rem", lineHeight: 1.8, resize: "none", boxSizing: "border-box",
            }}
          />
        ) : (
          <div style={{ fontSize: "0.90rem", color: "var(--fg-muted)", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {content}
          </div>
        )}
      </div>

      {/* Action bar */}
      <ActionBar>
        {entry.kind === "review" && (
          <>
            <ActionBtn onClick={approve} disabled={saving} primary color="#22c55e" icon={<Check size={14} strokeWidth={2.5} />}>
              Approve <Kbd>A</Kbd>
            </ActionBtn>
            <ActionBtn onClick={schedule} disabled={saving} color="rgba(167,139,250,0.8)" icon={<Calendar size={13} />}>
              Schedule
            </ActionBtn>
          </>
        )}
        {entry.kind === "post" && (
          <ActionBtn onClick={markPosted} disabled={saving} primary color="#a78bfa" icon={<Send size={13} />}>
            Mark posted
          </ActionBtn>
        )}

        <div style={{ flex: 1 }} />

        {editing ? (
          <>
            <ActionBtn onClick={() => { setSaving(true); updateContentItem({ data: { id: item.id, content, title: title || null } }).then(() => { setEditing(false); setSaving(false); }); }} disabled={saving} color="var(--fg-muted)">
              Save
            </ActionBtn>
            <ActionBtn onClick={() => { setContent(item.content); setTitle(item.title ?? ""); setEditing(false); }} color="rgba(165,182,214,0.4)">
              Cancel
            </ActionBtn>
          </>
        ) : (
          <ActionBtn onClick={() => setEditing(true)} icon={<Edit3 size={13} />} color="rgba(165,182,214,0.45)">
            Edit <Kbd>E</Kbd>
          </ActionBtn>
        )}

        <ActionBtn onClick={() => copy(content)} icon={copied ? <CheckCheck size={13} /> : <Copy size={13} />} color={copied ? "#22c55e" : "rgba(165,182,214,0.45)"}>
          {copied ? "Copied" : "Copy"}
        </ActionBtn>

        {entry.kind === "review" && (
          <ActionBtn onClick={reject} icon={<X size={13} />} color="rgba(239,68,68,0.5)">
            Skip <Kbd>R</Kbd>
          </ActionBtn>
        )}

        <Link to="/products/$id/distribution" params={{ id: String(item.projectId) }} style={{ textDecoration: "none" }}>
          <ActionBtn icon={<ExternalLink size={13} />} color="rgba(165,182,214,0.4)">Open</ActionBtn>
        </Link>
      </ActionBar>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", width: 80, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.82rem", color: valueColor ?? "rgba(165,182,214,0.65)" }}>
        {value}
      </span>
    </div>
  );
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 6,
      padding: "12px 48px",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(0,0,0,0.1)",
    }}>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary, color, icon }: {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px",
        background: primary ? `${color}18` : "transparent",
        border: `1px solid ${primary ? `${color}40` : "rgba(255,255,255,0.09)"}`,
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.78rem", fontWeight: primary ? 700 : 400,
        color: disabled ? "rgba(165,182,214,0.2)" : color,
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}>

      {icon}
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      marginLeft: 2,
      padding: "0px 4px", borderRadius: 3,
      fontSize: "0.60rem", fontWeight: 700,
      background: "rgba(255,255,255,0.08)", color: "rgba(165,182,214,0.4)",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      {children}
    </span>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyPane() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ fontSize: "1.5rem", marginBottom: 4, opacity: 0.3 }}>✦</div>
      <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 500, color: "rgba(165,182,214,0.3)" }}>Select an item</p>
      <p style={{ margin: 0, fontSize: "0.74rem", color: "rgba(165,182,214,0.2)" }}>j / k to navigate · a approve · r skip</p>
    </div>
  );
}

function AllClearPane() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>✦</div>
      <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "rgba(165,182,214,0.4)" }}>Inbox zero</p>
      <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(165,182,214,0.25)", lineHeight: 1.6, textAlign: "center", maxWidth: 260 }}>
        Nothing pending. Go to a project's Distribution tab to generate content.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function InboxPage() {
  const data = Route.useLoaderData() as {
    toReview: ReviewItem[];
    toPost: ReviewItem[];
    toGenerate: GenerateItem[];
  };

  const [postItems, setPostItems] = useState(data.toPost);
  const [reviewItems, setReviewItems] = useState(data.toReview);
  const [generateItems, setGenerateItems] = useState(data.toGenerate);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build unified list
  const allEntries: Entry[] = [
    ...postItems.map(item => ({ kind: "post" as const, id: `post-${item.id}`, item })),
    ...reviewItems.map(item => ({ kind: "review" as const, id: `review-${item.id}`, item })),
    ...generateItems.map(item => ({ kind: "generate" as const, id: `gen-${item.projectId}-${item.playbookId}`, item })),
  ];

  const folderEntries: Entry[] = folder === "inbox" ? allEntries
    : folder === "post" ? allEntries.filter(e => e.kind === "post")
      : folder === "review" ? allEntries.filter(e => e.kind === "review")
        : allEntries.filter(e => e.kind === "generate");

  const selectedEntry = folderEntries.find(e => e.id === selectedId) ?? null;
  const selectedIdx = folderEntries.findIndex(e => e.id === selectedId);

  // Auto-select first item
  useEffect(() => {
    if (folderEntries.length > 0 && !folderEntries.find(e => e.id === selectedId)) {
      setSelectedId(folderEntries[0].id);
    }
  }, [folder, folderEntries.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = folderEntries[selectedIdx + 1];
        if (next) setSelectedId(next.id);
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = folderEntries[selectedIdx - 1];
        if (prev) setSelectedId(prev.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdx, folderEntries]);

  function removeEntry(id: string) {
    // Remove from data
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;
    if (entry.kind === "post") setPostItems(p => p.filter(i => `post-${i.id}` !== id));
    if (entry.kind === "review") setReviewItems(p => p.filter(i => `review-${i.id}` !== id));
    if (entry.kind === "generate") setGenerateItems(p => p.filter(i => `gen-${i.projectId}-${i.playbookId}` !== id));
    // Auto-advance
    const idx = folderEntries.findIndex(e => e.id === id);
    const next = folderEntries[idx + 1] ?? folderEntries[idx - 1];
    setSelectedId(next?.id ?? null);
  }

  const counts = {
    inbox: allEntries.length,
    post: postItems.length,
    review: reviewItems.length,
    generate: generateItems.length,
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: 280, flexShrink: 0,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}>
        {/* Folder nav */}
        <div style={{ padding: "16px 12px 12px" }}>
          {(["inbox", "post", "review", "generate"] as Folder[]).map(f => (
            <FolderItem
              key={f}
              folder={f}
              active={folder === f}
              label={FOLDER_CFG[f].label}
              color={FOLDER_CFG[f].color}
              count={counts[f]}
              onClick={() => setFolder(f)}
            />
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 12px 8px" }} />

        {/* Item list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {folderEntries.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(165,182,214,0.25)" }}>Nothing here</p>
            </div>
          ) : (
            folderEntries.map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                selected={entry.id === selectedId}
                onSelect={() => setSelectedId(entry.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ margin: 0, fontSize: "0.60rem", color: "rgba(165,182,214,0.2)", letterSpacing: "0.04em" }}>
            j/k navigate · a approve · r skip · e edit
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {counts.inbox === 0 ? (
          <AllClearPane />
        ) : !selectedEntry ? (
          <EmptyPane />
        ) : selectedEntry.kind === "generate" ? (
          <GeneratePane
            key={selectedEntry.id}
            entry={selectedEntry}
            onDone={() => removeEntry(selectedEntry.id)}
          />
        ) : (
          <ReviewPane
            key={selectedEntry.id}
            entry={selectedEntry}
            onApprove={selectedEntry.kind === "review" ? () => { } : undefined}
            onReject={selectedEntry.kind === "review" ? () => { } : undefined}
            onRemove={() => removeEntry(selectedEntry.id)}
          />
        )}
      </div>
    </div>
  );
}
