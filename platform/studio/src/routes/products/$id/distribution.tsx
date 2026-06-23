import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check, X, Clock, ExternalLink, Plus, Edit3, Eye, CheckCircle2,
  Calendar, Zap, GripVertical, Copy, CheckCheck,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { useProjectContext } from "~/lib/project-context";
import { getOpportunitiesForSelect } from "~/lib/distribution-fns";
import type { OppForSelect } from "~/lib/distribution-fns";
import {
  getContentItems, updateContentItem, createContentItem, deleteContentItem, generateCampaign,
} from "~/lib/distribution-fns";
import { getProjectPlaybookInstances, updateProjectPlaybookInstance } from "~/lib/project-fns";
import type { DistributionPlaybook, ProjectPlaybookInstance, ContentItem } from "~/db/schema";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/products/$id/distribution")({
  loader: async ({ params }) => {
    const productId = parseInt(params.id, 10);
    const { getProduct } = await import("~/lib/product-fns");
    const product = await getProduct({ data: { id: productId } });
    const ideaId = product?.ideaId ?? 0;
    const [items, opportunities, playbookInstances] = await Promise.all([
      productId ? getContentItems({ data: { productId } }) : Promise.resolve([]),
      ideaId ? getOpportunitiesForSelect({ data: { projectId: ideaId } }) : Promise.resolve([]),
      productId ? getProjectPlaybookInstances({ data: { productId } }) : Promise.resolve([]),
    ]);
    return { items, opportunities, playbookInstances, productId };
  },
  staleTime: 10_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DistributionPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type RichContentItem = ContentItem & { playbookName: string | null; oppTitle: string | null; platformMeta: Record<string, unknown> };
type PlaybookRow = { playbook: DistributionPlaybook; instance: ProjectPlaybookInstance };
type Tab = "queue" | "strategy";
type StatusFilter = "all" | "pending_review" | "approved" | "scheduled" | "published" | "rejected";

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORM_CFG: Record<string, { label: string; color: string; bg: string; limit?: number }> = {
  reddit: { label: "Reddit", color: "#ff4500", bg: "rgba(255,69,0,0.1)" },
  hn: { label: "Hacker News", color: "#ff6600", bg: "rgba(255,102,0,0.1)" },
  twitter: { label: "Twitter / X", color: "#1da1f2", bg: "rgba(29,161,242,0.1)", limit: 280 },
  linkedin: { label: "LinkedIn", color: "#0077b5", bg: "rgba(0,119,181,0.1)" },
  newsletter: { label: "Newsletter", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  ph: { label: "Product Hunt", color: "#da552f", bg: "rgba(218,85,47,0.1)" },
  youtube: { label: "YouTube", color: "#ff0000", bg: "rgba(255,0,0,0.1)" },
  seo: { label: "SEO / AEO", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  bluesky: { label: "Bluesky", color: "#0085ff", bg: "rgba(0,133,255,0.1)" },
};

const P = (p: string): { label: string; color: string; bg: string; limit?: number } =>
  PLATFORM_CFG[p] ?? { label: p, color: "var(--fg-subtle)", bg: "rgba(255,255,255,0.05)" };

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending_review: { label: "Review", color: "#f59e0b", icon: "⏳" },
  approved: { label: "Approved", color: "#60a5fa", icon: "✓" },
  scheduled: { label: "Scheduled", color: "#a78bfa", icon: "📅" },
  published: { label: "Published", color: "#22c55e", icon: "✦" },
  rejected: { label: "Rejected", color: "rgba(250,250,250,0.25)", icon: "✗" },
} as const;

// ── Effort config (replaces time horizon) ─────────────────────────────────────

const EFFORT_CFG: Record<string, { label: string; color: string }> = {
  "one-time": { label: "one-time", color: "rgba(96,165,250,0.6)" },
  "ongoing": { label: "ongoing", color: "rgba(245,158,11,0.7)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestSchedule(platform: string): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilTue = ((2 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + (day === 0 || day === 6 ? daysUntilTue : 1));
  d.setHours(9, 0, 0, 0);
  if (platform === "twitter" || platform === "linkedin") d.setHours(12, 0, 0, 0);
  if (platform === "newsletter") d.setHours(8, 0, 0, 0);
  return d;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return { copied, copy };
}

// ── Content Timeline ──────────────────────────────────────────────────────────

function CalendarSidebar({ items }: { items: RichContentItem[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const scheduledByDay = new Map<string, RichContentItem[]>();
  for (const item of items) {
    if ((item.status === "scheduled" || item.status === "published") && item.scheduledAt) {
      const d = new Date(item.scheduledAt); d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      if (!scheduledByDay.has(key)) scheduledByDay.set(key, []);
      scheduledByDay.get(key)!.push(item);
    }
  }

  const months: { label: string; days: Date[] }[] = [];
  for (let m = 0; m < 12; m++) {
    const base = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const label = base.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    const days: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(base.getFullYear(), base.getMonth(), d));
    }
    months.push({ label, days });
  }

  const totalItems = [...scheduledByDay.values()].reduce((s, a) => s + a.length, 0);

  return (
    <div style={{
      width: 196, flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "rgba(0,0,0,0.12)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "10px 12px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.28)", marginBottom: 2 }}>
          Calendar
        </div>
        <div style={{ fontSize: "0.64rem", color: "rgba(250,250,250,0.22)" }}>
          {totalItems > 0 ? `${totalItems} scheduled` : "Nothing scheduled"}
        </div>
      </div>

      {/* Months stacked, vertically scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {months.map(({ label, days }) => {
            const firstDow = days[0].getDay();
            return (
              <div key={label}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(250,250,250,0.4)", marginBottom: 6, letterSpacing: "0.04em" }}>
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} style={{ fontSize: "0.48rem", color: "rgba(250,250,250,0.18)", textAlign: "center", fontWeight: 600 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
                  {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(day => {
                    const key = day.toISOString();
                    const dayItems = scheduledByDay.get(key) ?? [];
                    const isToday = day.toISOString() === today.toISOString();
                    const isPast = day < today;
                    const hasContent = dayItems.length > 0;
                    const topCfg = dayItems[0] ? P(dayItems[0].platform) : null;
                    const dayTitle = hasContent
                      ? dayItems.map(it => {
                        const t = it.scheduledAt
                          ? new Date(it.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "";
                        return `${P(it.platform).label}${t ? " " + t : ""}: ${it.title || it.content.slice(0, 50)}`;
                      }).join("\n")
                      : undefined;
                    return (
                      <div key={key} title={dayTitle} style={{
                        height: 20, borderRadius: 2,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: hasContent ? "pointer" : "default",
                        background: isToday ? "rgba(255,255,255,0.1)" : hasContent ? `${topCfg!.color}35` : isPast ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                        border: isToday ? "1px solid rgba(255,255,255,0.22)" : hasContent ? `1px solid ${topCfg!.color}55` : "1px solid transparent",
                        position: "relative",
                      }}>
                        <span style={{ fontSize: "0.48rem", fontWeight: isToday || hasContent ? 700 : 400, color: isToday ? "var(--fg)" : hasContent ? topCfg!.color : isPast ? "rgba(250,250,250,0.14)" : "rgba(250,250,250,0.28)" }}>
                          {day.getDate()}
                        </span>
                        {dayItems.length > 1 && (
                          <div style={{ position: "absolute", bottom: 1, right: 1, display: "flex", gap: 1 }}>
                            {dayItems.slice(0, 3).map((it, j) => (
                              <div key={j} style={{ width: 2, height: 2, borderRadius: "50%", background: P(it.platform).color }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ── Platform Preview ─────────────────────────────────────────────────────────

function PlatformPreview({ platform, title, content, meta }: {
  platform: string; title: string; content: string; meta: Record<string, unknown>;
}) {
  const cfg = P(platform);

  if (platform === "reddit") {
    return (
      <div style={{ background: "#1a1a1b", border: "1px solid #343536", borderRadius: 4, overflow: "hidden", fontFamily: "-apple-system, sans-serif" }}>
        <div style={{ padding: "8px 12px", background: "#161617", borderBottom: "1px solid #343536", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.74rem", color: "#ff4500", fontWeight: 700 }}>r/{(meta.subreddit as string) || "SaaS"}</span>
          <span style={{ fontSize: "0.68rem", color: "rgba(215,218,220,0.45)" }}>• Posted by u/you</span>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {title && <h3 style={{ margin: "0 0 10px", fontSize: "1rem", fontWeight: 700, color: "#d7dadc", lineHeight: 1.4 }}>{title}</h3>}
          <div style={{ fontSize: "0.84rem", color: "rgba(215,218,220,0.8)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {content.slice(0, 600)}{content.length > 600 ? "…" : ""}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: "0.72rem", color: "rgba(215,218,220,0.4)" }}>
            <span>▲ 0 points</span><span>💬 0 comments</span><span>⇧ Share</span>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "hn") {
    return (
      <div style={{ background: "#f6f6ef", borderRadius: 4, overflow: "hidden", fontFamily: "Verdana, Geneva, sans-serif" }}>
        <div style={{ background: "#ff6600", padding: "4px 8px" }}>
          <span style={{ fontSize: "0.80rem", fontWeight: 700, color: "#000" }}>Hacker News</span>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.88rem", color: "#000" }}><strong>{title || "Show HN: Your Product"}</strong></p>
          <p style={{ margin: "0 0 10px", fontSize: "0.76rem", color: "#828282" }}>1 point by you · just now · 0 comments</p>
          <div style={{ fontSize: "0.82rem", color: "#333", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {content.slice(0, 400)}{content.length > 400 ? "…" : ""}
          </div>
        </div>
      </div>
    );
  }

  if (platform === "twitter") {
    const tweets = content.split(/\n---\n/);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tweets.slice(0, 3).map((tweet, i) => (
          <div key={i} style={{ background: "#000", border: "1px solid #2f3336", borderRadius: 12, padding: "16px", fontFamily: "-apple-system, sans-serif" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#333", flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 700, color: "#e7e9ea" }}>You</p>
                <p style={{ margin: 0, fontSize: "0.76rem", color: "#71767b" }}>@yourhandle</p>
              </div>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "0.92rem", color: "#e7e9ea", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tweet.trim().slice(0, 280)}</p>
            <div style={{ fontSize: "0.72rem", color: "#71767b", display: "flex", gap: 16 }}>
              <span>💬 0</span><span>🔁 0</span><span>❤️ 0</span>
            </div>
          </div>
        ))}
        {tweets.length > 3 && <p style={{ fontSize: "0.72rem", color: "rgba(250,250,250,0.3)", textAlign: "center" }}>+{tweets.length - 3} more</p>}
      </div>
    );
  }

  if (platform === "newsletter") {
    return (
      <div style={{ background: "#fff", borderRadius: 4, overflow: "hidden", fontFamily: "Georgia, serif" }}>
        <div style={{ padding: "16px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#6b7280" }}>Subject</p>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{title || "(No subject)"}</p>
        </div>
        <div style={{ padding: "20px 24px", fontSize: "0.90rem", color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>
          {content}
        </div>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", fontFamily: "-apple-system, sans-serif" }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#0077b5", flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 600, color: "rgba(0,0,0,0.9)" }}>You</p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(0,0,0,0.6)" }}>Founder • Just now</p>
          </div>
        </div>
        <div style={{ padding: "0 16px 16px", fontSize: "0.86rem", color: "rgba(0,0,0,0.9)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {content.slice(0, 500)}{content.length > 500 ? "…" : ""}
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e0e0e0", display: "flex", gap: 16, fontSize: "0.76rem", color: "#666" }}>
          <span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
      {title && <h3 style={{ margin: "0 0 10px", fontSize: "1rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.4 }}>{title}</h3>}
      <div style={{ fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {content.slice(0, 800)}{content.length > 800 ? "…" : ""}
      </div>
    </div>
  );
}

// ── New Item Modal ────────────────────────────────────────────────────────────

function NewItemModal({ productId, onCreated, onClose }: {
  productId: number;
  onCreated: (item: RichContentItem) => void;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState("reddit");
  const [subreddit, setSubreddit] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const cfg = P(platform);
  const hasTitle = ["hn", "ph", "newsletter", "seo", "youtube"].includes(platform);
  const limit = PLATFORM_CFG[platform]?.limit;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function save() {
    if (!content.trim()) return;
    setBusy(true);
    try {
      const meta = platform === "reddit" && subreddit ? { subreddit } : {};
      const row = await createContentItem({ data: { productId, platform, platformMeta: meta, title: title.trim() || undefined, content: content.trim() } });
      onCreated({ ...row, playbookName: null, oppTitle: null, platformMeta: meta } as RichContentItem);
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 900, height: "min(700px, 90vh)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        {/* Left: Form */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--fg)" }}>New content</span>
            <Button variant="ghost" size="sm" onClick={onClose} style={{ color: "rgba(250,250,250,0.3)", fontSize: "1rem", lineHeight: 1, padding: "4px 6px", height: "auto" }}>×</Button>
          </div>

          {/* Platform picker */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)" }}>Platform</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(PLATFORM_CFG).map(([p, c]) => (
                <button key={p} type="button" onClick={() => setPlatform(p)} style={{
                  padding: "5px 11px", fontSize: "0.72rem", fontWeight: platform === p ? 700 : 400,
                  border: `1px solid ${platform === p ? c.color : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  background: platform === p ? c.bg : "transparent",
                  color: platform === p ? c.color : "var(--fg-subtle)",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {platform === "reddit" && (
              <div>
                <label style={{ display: "block", fontSize: "0.66rem", fontWeight: 600, color: "rgba(250,250,250,0.4)", marginBottom: 5, letterSpacing: "0.06em" }}>SUBREDDIT</label>
                <input value={subreddit} onChange={e => setSubreddit(e.target.value)} placeholder="e.g. SaaS"
                  style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "8px 12px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            {hasTitle && (
              <div>
                <label style={{ display: "block", fontSize: "0.66rem", fontWeight: 600, color: "rgba(250,250,250,0.4)", marginBottom: 5, letterSpacing: "0.06em" }}>TITLE / SUBJECT</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title…"
                  style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "8px 12px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ display: "block", fontSize: "0.66rem", fontWeight: 600, color: "rgba(250,250,250,0.4)", marginBottom: 5, letterSpacing: "0.06em" }}>CONTENT</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your content…"
                style={{ flex: 1, minHeight: 220, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "10px 12px", fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.7, boxSizing: "border-box" }} />
              {limit && (
                <p style={{ margin: "6px 0 0", fontSize: "0.66rem", color: content.length > limit ? "#ef4444" : "rgba(250,250,250,0.25)", fontFamily: "monospace" }}>
                  {content.length}/{limit}
                </p>
              )}
            </div>
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={save} disabled={busy || !content.trim()}>{busy ? "Saving…" : "Add to queue"}</Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </div>

        {/* Right: Live preview */}
        <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <Eye size={12} style={{ color: "rgba(250,250,250,0.3)" }} />
            <span style={{ fontSize: "0.70rem", fontWeight: 700, color: "rgba(250,250,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Preview</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <PlatformPreview platform={platform} title={title} content={content || "Your content will appear here…"} meta={subreddit ? { subreddit } : {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Queue Item Editor ─────────────────────────────────────────────────────────

function ItemEditor({
  item, onUpdate, onApprove, onReject, onNext, onPrev, total, index,
}: {
  item: RichContentItem;
  onUpdate: (patch: Partial<RichContentItem>) => void;
  onApprove: () => void;
  onReject: () => void;
  onNext: () => void;
  onPrev: () => void;
  total: number;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [content, setContent] = useState(item.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { copied, copy } = useCopy();
  const limit = PLATFORM_CFG[item.platform]?.limit;
  const cfg = P(item.platform);
  const status = STATUS_CFG[item.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending_review;

  useEffect(() => { setTitle(item.title ?? ""); setContent(item.content); setEditing(false); }, [item.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "a" && item.status === "pending_review") onApprove();
      if (e.key === "r") onReject();
      if (e.key === "j" || e.key === "ArrowDown") onNext();
      if (e.key === "k" || e.key === "ArrowUp") onPrev();
      if (e.key === "e") { setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item.id, item.status]);

  function saveEdits() {
    onUpdate({ title: title || null, content });
    updateContentItem({ data: { id: item.id, title: title || null, content } });
    setEditing(false);
  }

  function scheduleItem() {
    const suggested = suggestSchedule(item.platform);
    updateContentItem({ data: { id: item.id, status: "scheduled", scheduledAtMs: suggested.getTime() } });
    onUpdate({ status: "scheduled", scheduledAt: suggested });
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)" }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
          {cfg.label}
        </span>
        {!!item.platformMeta?.subreddit && (
          <span style={{ fontSize: "0.72rem", color: "rgba(250,250,250,0.4)" }}>r/{item.platformMeta.subreddit as string}</span>
        )}
        {item.playbookName && (
          <span style={{ fontSize: "0.68rem", color: "rgba(250,250,250,0.2)" }}>via {item.playbookName}</span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.68rem", color: "rgba(250,250,250,0.2)" }}>{index + 1} / {total}</span>
        <Button variant="outline" size="sm" onClick={onPrev}>↑</Button>
        <Button variant="outline" size="sm" onClick={onNext}>↓</Button>
      </div>

      {/* Split: editor + preview */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", flex: 1 }}>Content</span>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                <Edit3 size={10} /> Edit <span style={{ fontSize: "0.58rem", opacity: 0.5 }}>E</span>
              </Button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="primary" size="sm" onClick={saveEdits}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => { setTitle(item.title ?? ""); setContent(item.content); setEditing(false); }}>Cancel</Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => copy(content)} style={{ color: copied ? "#22c55e" : "var(--fg-subtle)" }}>
              {copied ? <CheckCheck size={10} /> : <Copy size={10} />}
            </Button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {["hn", "ph", "newsletter", "seo", "youtube"].includes(item.platform) && (
              editing ? (
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title / Subject"
                  style={{ width: "100%", marginBottom: 12, background: "transparent", border: "none", outline: "none", color: "var(--fg)", fontSize: "1rem", fontWeight: 700, fontFamily: "inherit", padding: 0, boxSizing: "border-box" }} />
              ) : (
                title && <h3 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.4 }}>{title}</h3>
              )
            )}
            {editing ? (
              <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
                style={{ width: "100%", flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--fg-muted)", fontSize: "0.88rem", fontFamily: "inherit", resize: "none", lineHeight: 1.75, minHeight: 300, boxSizing: "border-box" }} />
            ) : (
              <div style={{ fontSize: "0.88rem", color: "var(--fg-muted)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{content}</div>
            )}
            {limit && (
              <p style={{ margin: "8px 0 0", fontSize: "0.68rem", color: content.length > limit ? "#ef4444" : "rgba(250,250,250,0.25)", fontFamily: "monospace" }}>
                {content.length}/{limit}
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <Eye size={11} style={{ color: "rgba(250,250,250,0.3)" }} />
            <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)" }}>Preview</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            <PlatformPreview platform={item.platform} title={editing ? title : (item.title ?? "")} content={editing ? content : item.content} meta={item.platformMeta} />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ flexShrink: 0, padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.15)" }}>
        {item.status === "pending_review" && (
          <>
            <Button variant="primary" size="md" onClick={onApprove} style={{ gap: 7 }}>
              <Check size={14} strokeWidth={3} /> Approve <span style={{ fontSize: "0.62rem", opacity: 0.5, fontWeight: 400 }}>A</span>
            </Button>
            <Button variant="outline" size="md" onClick={scheduleItem} style={{ gap: 6, borderColor: "rgba(167,139,250,0.4)", color: "#a78bfa" }}>
              <Calendar size={13} /> Schedule
            </Button>
          </>
        )}
        {item.status === "approved" && (
          <Button variant="primary" size="md" onClick={() => { updateContentItem({ data: { id: item.id, status: "published", publishedAtMs: Date.now() } }); onUpdate({ status: "published", publishedAt: new Date() }); }} style={{ gap: 7, background: "#22c55e" }}>
            Mark published
          </Button>
        )}
        {item.status === "scheduled" && item.scheduledAt && (
          <span style={{ fontSize: "0.78rem", color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={13} /> {new Date(item.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {item.status !== "rejected" && (
          <Button variant="destructive" size="sm" onClick={onReject} style={{ gap: 5 }}>
            <X size={12} /> Reject <span style={{ fontSize: "0.60rem", opacity: 0.5 }}>R</span>
          </Button>
        )}
        {item.status === "rejected" && (
          <Button variant="ghost" size="sm" onClick={() => { updateContentItem({ data: { id: item.id, status: "pending_review" } }); onUpdate({ status: "pending_review" }); }}>
            ↺ Restore
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Sidebar grouping ──────────────────────────────────────────────────────────

function groupSidebarItems(items: RichContentItem[], filter: StatusFilter): { label: string; items: RichContentItem[] }[] {
  const useTimeGroups = filter === "scheduled" || filter === "all";
  if (!useTimeGroups) return [{ label: "", items }];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const nextWeekStart = new Date(weekEnd); nextWeekStart.setDate(weekEnd.getDate() + 1);
  const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

  const buckets = new Map<string, { order: number; items: RichContentItem[] }>();

  function getLabel(item: RichContentItem): { label: string; order: number } {
    const d = item.scheduledAt ? new Date(item.scheduledAt) : null;
    if (!d) {
      const statusLabels: Record<string, string> = { pending_review: "Needs review", approved: "Approved", rejected: "Rejected" };
      return { label: statusLabels[item.status] ?? item.status, order: -1 };
    }
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    if (day <= weekEnd) return { label: "This week", order: 0 };
    if (day <= nextWeekEnd) return { label: "Next week", order: 1 };
    const monthKey = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const order = d.getFullYear() * 100 + d.getMonth();
    return { label: monthKey, order };
  }

  // Sort: unscheduled first, then by date
  const sorted = [...items].sort((a, b) => {
    const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : -Infinity;
    const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : -Infinity;
    if (da === -Infinity && db === -Infinity) return 0;
    if (da === -Infinity) return -1;
    if (db === -Infinity) return 1;
    return da - db;
  });

  for (const item of sorted) {
    const { label, order } = getLabel(item);
    if (!buckets.has(label)) buckets.set(label, { order, items: [] });
    buckets.get(label)!.items.push(item);
  }

  return [...buckets.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, { items }]) => ({ label, items }));
}

// ── Queue Tab ─────────────────────────────────────────────────────────────────

function QueueTab({ items: initial, productId, onItemAdded }: { items: RichContentItem[]; productId: number; onItemAdded?: () => void }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<StatusFilter>("pending_review");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = items.filter(i => filter === "all" ? i.status !== "rejected" : i.status === filter);
  const selectedIndex = filtered.findIndex(i => i.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filter]);

  useEffect(() => {
    if (selectedId && !filtered.find(i => i.id === selectedId) && filtered.length > 0) {
      const nextIndex = Math.min(selectedIndex, filtered.length - 1);
      setSelectedId(filtered[nextIndex >= 0 ? nextIndex : 0]?.id ?? null);
    }
  }, [filtered.length]);

  function updateItem(id: number, patch: Partial<RichContentItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } as RichContentItem : i));
  }

  async function approve(item: RichContentItem) {
    await updateContentItem({ data: { id: item.id, status: "approved" } });
    updateItem(item.id, { status: "approved" });
    const nextPending = filtered.find(i => i.id !== item.id && i.status === "pending_review");
    if (nextPending) setSelectedId(nextPending.id);
  }

  async function reject(item: RichContentItem) {
    await updateContentItem({ data: { id: item.id, status: "rejected" } });
    updateItem(item.id, { status: "rejected" });
    const nextIdx = selectedIndex < filtered.length - 1 ? selectedIndex : selectedIndex - 1;
    setSelectedId(filtered[nextIdx]?.id ?? null);
  }

  const counts: Record<string, number> = {
    pending_review: items.filter(i => i.status === "pending_review").length,
    approved: items.filter(i => i.status === "approved").length,
    scheduled: items.filter(i => i.status === "scheduled").length,
    published: items.filter(i => i.status === "published").length,
  };

  return (
    <>
      {showModal && (
        <NewItemModal
          productId={productId}
          onCreated={item => { setItems(prev => [item, ...prev]); setSelectedId(item.id); setFilter("pending_review"); onItemAdded?.(); }}
          onClose={() => setShowModal(false)}
        />
      )}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.70rem", fontWeight: 700, color: "var(--fg-subtle)" }}>Queue</span>
            <Button variant="outline" size="sm" onClick={() => setShowModal(true)} style={{ gap: 5 }}>
              <Plus size={10} /> New
            </Button>
          </div>

          {/* Filters */}
          <div style={{ flexShrink: 0, padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
            {(["pending_review", "approved", "scheduled", "published", "all"] as StatusFilter[]).map(s => {
              const cfg = s === "all" ? { label: "All", color: "var(--fg-subtle)", icon: "≡" } : STATUS_CFG[s as keyof typeof STATUS_CFG];
              const count = s === "all" ? items.filter(i => i.status !== "rejected").length : (counts[s] ?? 0);
              return (
                <button key={s} type="button" onClick={() => setFilter(s)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: filter === s ? "rgba(255,255,255,0.05)" : "transparent", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                  <span style={{ fontSize: "0.70rem", minWidth: 14 }}>{cfg.icon}</span>
                  <span style={{ flex: 1, fontSize: "0.76rem", color: filter === s ? (s === "all" ? "var(--fg)" : (cfg as any).color) : "var(--fg-subtle)", fontWeight: filter === s ? 600 : 400 }}>
                    {cfg.label}
                  </span>
                  {count > 0 && <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0 5px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "rgba(250,250,250,0.4)" }}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "20px 14px", textAlign: "center" }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.76rem", color: "rgba(250,250,250,0.3)", lineHeight: 1.6 }}>
                  {items.length === 0 ? "Queue is empty." : "Nothing here."}
                </p>
                {items.length === 0 && (
                  <p style={{ margin: 0, fontSize: "0.70rem", color: "rgba(250,250,250,0.2)", lineHeight: 1.5 }}>
                    Generate from Strategy tab or click + New.
                  </p>
                )}
              </div>
            )}
            {groupSidebarItems(filtered, filter).map(({ label, items: groupItems }) => (
              <div key={label}>
                {label && (
                  <div style={{ padding: "8px 12px 4px", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.22)", userSelect: "none" }}>
                    {label}
                  </div>
                )}
                {groupItems.map(item => {
                  const cfg = P(item.platform);
                  const selected = item.id === selectedId;
                  const timeStr = item.scheduledAt && (filter === "scheduled" || filter === "all")
                    ? new Date(item.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                    : null;
                  const selectedBg = "rgba(255,255,255,0.06)";
                  const hoverBg = "rgba(255,255,255,0.03)";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        display: "block", width: "100%", padding: "9px 12px",
                        background: selected ? selectedBg : "transparent",
                        border: "none",
                        borderLeft: `2px solid ${selected ? cfg.color : "transparent"}`,
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <span style={{
                          fontSize: "0.58rem", fontWeight: 700,
                          padding: "1px 5px", borderRadius: 2,
                          background: `${cfg.color}18`, color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                        {!!item.platformMeta?.subreddit && (
                          <span style={{ fontSize: "0.56rem", color: "rgba(250,250,250,0.28)" }}>
                            r/{item.platformMeta.subreddit as string}
                          </span>
                        )}
                        {timeStr && (
                          <span style={{ fontSize: "0.56rem", color: "rgba(250,250,250,0.28)", marginLeft: "auto" }}>
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <p style={{
                        margin: 0, fontSize: "0.74rem",
                        color: selected ? "var(--fg-muted)" : "rgba(250,250,250,0.42)",
                        lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {item.title || item.content.slice(0, 80)}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        {selectedItem ? (
          <ItemEditor
            key={selectedItem.id}
            item={selectedItem}
            index={selectedIndex}
            total={filtered.length}
            onUpdate={(patch) => updateItem(selectedItem.id, patch)}
            onApprove={() => approve(selectedItem)}
            onReject={() => reject(selectedItem)}
            onNext={() => { const next = filtered[selectedIndex + 1]; if (next) setSelectedId(next.id); }}
            onPrev={() => { const prev = filtered[selectedIndex - 1]; if (prev) setSelectedId(prev.id); }}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(250,250,250,0.2)" }}>
            <p style={{ margin: 0, fontSize: "0.84rem" }}>Select an item to review</p>
            <Button variant="outline" size="sm" onClick={() => setShowModal(true)} style={{ gap: 6 }}>
              <Plus size={12} /> Add content manually
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Strategy Tab ──────────────────────────────────────────────────────────────

const GENERATABLE_SLUGS = new Set(["community-posts", "newsletter", "free-tool", "viral-artifact", "aeo", "content-repurposing"]);

function StrategyTab({
  playbookInstances, productId, projectName, topOpp, onGenerated,
}: {
  playbookInstances: PlaybookRow[];
  productId: number;
  projectName: string;
  topOpp: OppForSelect | null;
  onGenerated: (count: number) => void;
}) {
  const [rows, setRows] = useState<PlaybookRow[]>(playbookInstances);
  const [generating, setGenerating] = useState<Set<number>>(new Set());
  const draggedId = useRef<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  async function toggleActive(instance: ProjectPlaybookInstance) {
    const isActive = !instance.isActive;
    await updateProjectPlaybookInstance({ data: { id: instance.id, isActive } });
    setRows(prev => prev.map(r => r.instance.id === instance.id ? { ...r, instance: { ...r.instance, isActive } } : r));
  }

  async function handleGenerate(playbook: DistributionPlaybook, instance: ProjectPlaybookInstance) {
    setGenerating(prev => new Set([...prev, instance.id]));
    try {
      const result = await generateCampaign({
        data: {
          productId, playbookId: playbook.id, playbookSlug: playbook.slug,
          projectName, oppTitle: topOpp?.title, oppPain: topOpp?.painSummary,
          oppBuyer: topOpp?.insightsJson?.buyer_persona,
          oppFeatures: topOpp?.insightsJson?.v1_features,
        },
      });
      if (result.count > 0) onGenerated(result.count);
    } finally {
      setGenerating(prev => { const next = new Set(prev); next.delete(instance.id); return next; });
    }
  }

  function onDragStart(instanceId: number) {
    draggedId.current = instanceId;
  }

  function onDragOver(e: React.DragEvent, instanceId: number) {
    e.preventDefault();
    setDragOverId(instanceId);
  }

  function onDrop(e: React.DragEvent, targetInstanceId: number) {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId.current || draggedId.current === targetInstanceId) return;

    setRows(prev => {
      const active = prev.filter(r => r.instance.isActive);
      const inactive = prev.filter(r => !r.instance.isActive);
      const fromIdx = active.findIndex(r => r.instance.id === draggedId.current);
      const toIdx = active.findIndex(r => r.instance.id === targetInstanceId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const reordered = [...active];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      // persist new sort orders
      reordered.forEach((r, i) => {
        updateProjectPlaybookInstance({ data: { id: r.instance.id, sortOrder: i } });
      });
      return [...reordered.map((r, i) => ({ ...r, instance: { ...r.instance, sortOrder: i } })), ...inactive];
    });
    draggedId.current = null;
  }

  const active = rows.filter(r => r.instance.isActive);
  const inactive = rows.filter(r => !r.instance.isActive);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 24px 48px" }}>

        {active.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.84rem", color: "rgba(250,250,250,0.35)" }}>No active strategies yet.</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(250,250,250,0.2)" }}>Click a strategy below to activate it.</p>
          </div>
        )}

        {/* Active strategies - draggable */}
        {active.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
            {active.map(({ playbook: p, instance: inst }) => {
              const isGenerating = generating.has(inst.id);
              const canGenerate = GENERATABLE_SLUGS.has(p.slug);
              const effortCfg = EFFORT_CFG[p.effort] ?? { label: p.effort, color: "rgba(250,250,250,0.3)" };
              const isDragOver = dragOverId === inst.id;

              return (
                <div
                  key={inst.id}
                  draggable
                  onDragStart={() => onDragStart(inst.id)}
                  onDragOver={e => onDragOver(e, inst.id)}
                  onDrop={e => onDrop(e, inst.id)}
                  onDragEnd={() => setDragOverId(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "13px 14px",
                    background: "var(--bg-elevated)",
                    border: `1px solid ${isDragOver ? "rgba(255,255,255,0.2)" : "var(--border)"}`,
                    borderRadius: "var(--radius)",
                    cursor: "grab",
                    opacity: draggedId.current === inst.id ? 0.5 : 1,
                  }}>
                  <GripVertical size={14} style={{ color: "rgba(250,250,250,0.18)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)" }}>{p.name}</span>
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, padding: "1px 6px", borderRadius: 3, color: effortCfg.color, border: `1px solid ${effortCfg.color}44`, letterSpacing: "0.04em" }}>
                        {effortCfg.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.73rem", color: "rgba(250,250,250,0.35)", lineHeight: 1.4 }}>{p.description}</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canGenerate && (
                      <button type="button" onClick={() => handleGenerate(p, inst)} disabled={isGenerating}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: isGenerating ? "rgba(96,165,250,0.06)" : "rgba(0,255,136,0.08)", border: `1px solid ${isGenerating ? "rgba(96,165,250,0.2)" : "rgba(0,255,136,0.2)"}`, borderRadius: "var(--radius)", cursor: isGenerating ? "not-allowed" : "pointer", fontSize: "0.72rem", fontWeight: 700, color: isGenerating ? "#60a5fa" : "var(--accent)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        {isGenerating ? <>Generating…</> : <><Zap size={11} />Generate</>}
                      </button>
                    )}
                    <button type="button" onClick={() => toggleActive(inst)}
                      style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius)", cursor: "pointer", color: "rgba(250,250,250,0.2)", fontSize: "0.78rem" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inactive strategies */}
        {inactive.length > 0 && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.2)" }}>
              {active.length > 0 ? "More strategies" : "Available strategies"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {inactive.map(({ playbook: p, instance: inst }) => {
                const effortCfg = EFFORT_CFG[p.effort] ?? { label: p.effort, color: "rgba(250,250,250,0.3)" };
                return (
                  <button key={inst.id} type="button" onClick={() => toggleActive(inst)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "11px 12px", background: "transparent", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <Plus size={11} style={{ color: "rgba(250,250,250,0.25)", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontSize: "0.76rem", fontWeight: 600, color: "rgba(250,250,250,0.38)" }}>{p.name}</p>
                      <span style={{ fontSize: "0.58rem", fontWeight: 600, color: effortCfg.color }}>{effortCfg.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function DistributionPage() {
  const { items: initialItems, opportunities, playbookInstances, productId } = Route.useLoaderData() as {
    items: RichContentItem[];
    opportunities: OppForSelect[];
    playbookInstances: PlaybookRow[];
    productId: number;
  };
  const { project } = useProjectContext();
  const [tab, setTab] = useState<Tab>("queue");
  const [items, setItems] = useState<RichContentItem[]>(initialItems);
  const [newBadge, setNewBadge] = useState(0);

  const topOpp = opportunities[0] ?? null;
  const pendingCount = items.filter(i => i.status === "pending_review").length;

  function onGenerated(count: number) {
    setNewBadge(count);
    setTab("queue");
    getContentItems({ data: { productId } }).then(fresh => setItems(fresh as RichContentItem[]));
    setTimeout(() => setNewBadge(0), 4000);
  }

  const TAB_BASE: React.CSSProperties = {
    padding: "8px 18px", fontSize: "0.80rem", fontWeight: 600, border: "none",
    background: "transparent", cursor: "pointer", fontFamily: "inherit",
    borderBottom: "2px solid transparent", color: "var(--fg-subtle)", transition: "all 0.1s",
    display: "flex", alignItems: "center", gap: 6,
  };
  const TAB_ACTIVE: React.CSSProperties = { ...TAB_BASE, color: "var(--accent)", borderBottomColor: "var(--accent)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Tab bar */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", padding: "0 20px", display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,0.1)" }}>
        <button type="button" onClick={() => { setTab("queue"); setNewBadge(0); }} style={tab === "queue" ? TAB_ACTIVE : TAB_BASE}>
          Queue
          {pendingCount > 0 && (
            <span style={{ fontSize: "0.60rem", fontWeight: 700, padding: "0 5px", borderRadius: 10, background: newBadge > 0 ? "var(--accent)" : "rgba(245,158,11,0.25)", color: newBadge > 0 ? "#000" : "#f59e0b", minWidth: 16, textAlign: "center" }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setTab("strategy")} style={tab === "strategy" ? TAB_ACTIVE : TAB_BASE}>
          Strategy
        </button>
        <div style={{ flex: 1 }} />
        {newBadge > 0 && (
          <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, padding: "6px 0" }}>
            ✦ {newBadge} new items added
          </span>
        )}
        <p style={{ margin: "0 0 8px", fontSize: "0.60rem", color: "rgba(250,250,250,0.2)", letterSpacing: "0.06em" }}>
          J/K navigate · A approve · R reject · E edit
        </p>
      </div>

      {/* Content + Calendar sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {tab === "queue" ? (
            <QueueTab items={items} productId={productId} onItemAdded={() => getContentItems({ data: { productId } }).then(fresh => setItems(fresh as RichContentItem[]))} />
          ) : (
            <StrategyTab
              playbookInstances={playbookInstances}
              productId={productId}
              projectName={project.name}
              topOpp={topOpp}
              onGenerated={onGenerated}
            />
          )}
        </div>
        <CalendarSidebar items={items} />
      </div>
    </div>
  );
}
