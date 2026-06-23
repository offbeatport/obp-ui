import { useContext, useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/Button";
import {
  Check, X, Zap, Copy, CheckCheck, Edit3, ExternalLink,
  Calendar, Send, ArrowRight,
} from "lucide-react";
import { updateContentItem, generateCampaign, getContentItems } from "~/lib/distribution-fns";
import { InboxCtx, pc, type Entry } from "~/lib/inbox-ctx";

// ── Shared action bar components ──────────────────────────────────────────────

export function ActionBar({ children }: { children: React.ReactNode }) {
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

export function Btn({ children, onClick, disabled, variant = "ghost", color, icon, title }: {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  color: string;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={variant === "primary" ? "inbox-btn-primary" : "inbox-btn-ghost"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px",
        background: variant === "primary" ? `${color}18` : "transparent",
        border: `1px solid ${variant === "primary" ? `${color}40` : "rgba(255,255,255,0.09)"}`,
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.78rem", fontWeight: variant === "primary" ? 700 : 400,
        color: disabled ? "rgba(165,182,214,0.2)" : color,
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        transition: "background 0.1s",
      }}>
      {icon}
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      marginLeft: 2, padding: "0 4px", borderRadius: 3,
      fontSize: "0.60rem", fontWeight: 700,
      background: "rgba(255,255,255,0.07)", color: "rgba(165,182,214,0.35)",
      border: "1px solid rgba(255,255,255,0.09)",
    }}>
      {children}
    </span>
  );
}

export function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline" }}>
      <span style={{
        fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "rgba(165,182,214,0.28)",
        width: 80, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontSize: "0.82rem", color: valueColor ?? "rgba(165,182,214,0.6)" }}>
        {value}
      </span>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy };
}

// ── Generate pane ─────────────────────────────────────────────────────────────

export function GeneratePane({ entry }: { entry: Extract<Entry, { kind: "generate" }> }) {
  const { removeEntry, reloadQueue, setSelectedId, allEntries } = useContext(InboxCtx);
  const { item } = entry;
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [generatedCount, setGeneratedCount] = useState(0);

  async function generate() {
    setState("busy");
    try {
      const result = await generateCampaign({
        data: {
          productId: item.projectId,
          playbookId: item.playbookId,
          playbookSlug: item.playbookSlug,
          projectName: item.projectName,
        },
      });
      setGeneratedCount((result as any).count ?? 0);
      setState("done");
      // Reload queue data so new review items appear
      await reloadQueue();
    } catch {
      setState("idle");
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <MetaRow label="Project" value={item.projectName} />
          <MetaRow label="Strategy" value={item.playbookName} />
          <MetaRow label="Action" value="Generate content" valueColor="#f59e0b" />
        </div>

        <h2 style={{ margin: "0 0 16px", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--fg)", lineHeight: 1.2 }}>
          {item.playbookName}
        </h2>

        <p style={{ margin: "0 0 28px", fontSize: "0.88rem", color: "rgba(165,182,214,0.5)", lineHeight: 1.75 }}>
          No content has been generated for this strategy yet.{" "}
          Click <strong style={{ color: "var(--fg-muted)" }}>Generate</strong> to create content for{" "}
          <strong style={{ color: "var(--fg-muted)" }}>{item.projectName}</strong> using the{" "}
          <strong style={{ color: "var(--fg-muted)" }}>{item.playbookName}</strong> playbook.
          Generated pieces will appear in your <em>Review</em> folder.
        </p>

        {state === "done" && (
          <div style={{
            padding: "16px 20px", background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8,
          }}>
            <p style={{ margin: "0 0 10px", fontSize: "0.88rem", fontWeight: 600, color: "#22c55e" }}>
              ✦ {generatedCount > 0 ? `${generatedCount} pieces generated` : "Content generated"} - now in Review
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Move to the first review entry
                const first = allEntries.find(e => e.kind === "review");
                if (first) setSelectedId(first.id);
                removeEntry(entry.id);
              }}
              style={{
                gap: 6,
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                color: "#22c55e", fontWeight: 600,
              }}
            >
              View in Review <ArrowRight size={13} />
            </Button>
          </div>
        )}
      </div>

      <ActionBar>
        <Btn
          variant="primary"
          color="#f59e0b"
          icon={<Zap size={13} />}
          onClick={generate}
          disabled={state === "busy" || state === "done"}>
          {state === "busy" ? "Generating…" : state === "done" ? "Generated ✓" : "Generate"}
        </Btn>
        <Link to="/products/$id/distribution" params={{ id: String(item.projectId) }} style={{ textDecoration: "none" }}>
          <Btn color="rgba(165,182,214,0.4)" icon={<ExternalLink size={13} />}>Open project</Btn>
        </Link>
      </ActionBar>
    </div>
  );
}

// ── Review / Post pane ────────────────────────────────────────────────────────

export function ContentPane({ entry }: { entry: Extract<Entry, { kind: "review" | "post" }> }) {
  const { removeEntry } = useContext(InboxCtx);
  const { item } = entry;
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const [title, setTitle] = useState(item.title ?? "");
  const [saving, setSaving] = useState(false);
  const { copied, copy } = useCopy();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const platform = pc(item.platform);
  const hasTitle = ["hn", "ph", "newsletter", "seo", "youtube"].includes(item.platform);
  const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : null;

  useEffect(() => { setContent(item.content); setTitle(item.title ?? ""); setEditing(false); }, [item.id]);
  useEffect(() => { if (editing && textareaRef.current) textareaRef.current.focus(); }, [editing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "a" && entry.kind === "review") { e.preventDefault(); approve(); }
      if (e.key === "r") { e.preventDefault(); reject(); }
      if (e.key === "e") { e.preventDefault(); setEditing(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [entry.id, content, title]);

  async function approve() {
    setSaving(true);
    try {
      await updateContentItem({ data: { id: item.id, content, title: title || null, status: "approved" } });
      removeEntry(entry.id);
    } finally { setSaving(false); }
  }

  async function markPosted() {
    setSaving(true);
    try {
      await updateContentItem({ data: { id: item.id, status: "published", publishedAtMs: Date.now() } });
      removeEntry(entry.id);
    } finally { setSaving(false); }
  }

  async function reject() {
    await updateContentItem({ data: { id: item.id, status: "rejected" } });
    removeEntry(entry.id);
  }

  async function schedule() {
    // Schedule for next weekday at 9am
    const d = new Date();
    const dow = d.getDay();
    const daysToAdd = dow === 5 ? 3 : dow === 6 ? 2 : 1; // skip weekend
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(9, 0, 0, 0);
    await updateContentItem({ data: { id: item.id, status: "scheduled", scheduledAtMs: d.getTime() } });
    removeEntry(entry.id);
  }

  async function saveEdits() {
    setSaving(true);
    try {
      await updateContentItem({ data: { id: item.id, content, title: title || null } });
      setEditing(false);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px 24px" }}>

        {/* Meta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <MetaRow label="Project" value={item.projectName} />
          <MetaRow label="Channel" value={platform.label} valueColor={platform.color} />
          {(item as any).playbookName && <MetaRow label="Via" value={(item as any).playbookName} />}
          {scheduledAt && entry.kind === "post" && (
            <MetaRow
              label="Scheduled"
              value={scheduledAt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              valueColor="#a78bfa"
            />
          )}
          {entry.kind === "review" && (
            <div style={{ marginTop: 4, padding: "8px 12px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: "0.74rem", color: "rgba(34,197,94,0.7)", lineHeight: 1.5 }}>
                <strong>Approve</strong> → marks ready to post.{" "}
                <strong>Schedule</strong> → queues for next weekday 9am.{" "}
                <strong>Skip</strong> → rejects without posting.
              </p>
            </div>
          )}
        </div>

        {/* Title */}
        {hasTitle && (
          editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Subject / title"
              style={{
                width: "100%", marginBottom: 20,
                background: "transparent", border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.15)", outline: "none",
                color: "var(--fg)", fontSize: "1.35rem", fontWeight: 700,
                fontFamily: "inherit", padding: "0 0 10px",
                letterSpacing: "-0.02em", boxSizing: "border-box",
              }}
            />
          ) : (
            title && (
              <h2 style={{ margin: "0 0 20px", fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--fg)", lineHeight: 1.2 }}>
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
              width: "100%", minHeight: 320, background: "transparent",
              border: "none", outline: "none", color: "var(--fg-muted)",
              fontFamily: "inherit", fontSize: "0.90rem",
              lineHeight: 1.8, resize: "none", boxSizing: "border-box",
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
        {entry.kind === "review" && !editing && (
          <>
            <Btn variant="primary" color="#22c55e" icon={<Check size={13} strokeWidth={2.5} />} onClick={approve} disabled={saving}
              title="Mark as approved and move to Post queue">
              Approve <Kbd>A</Kbd>
            </Btn>
            <Btn color="rgba(167,139,250,0.8)" icon={<Calendar size={13} />} onClick={schedule} disabled={saving}
              title="Schedule for next weekday at 9am">
              Schedule to post
            </Btn>
          </>
        )}
        {entry.kind === "post" && !editing && (
          <Btn variant="primary" color="#a78bfa" icon={<Send size={13} />} onClick={markPosted} disabled={saving}
            title="Mark as posted - removes from queue">
            Mark as posted
          </Btn>
        )}

        <div style={{ flex: 1 }} />

        {editing ? (
          <>
            <Btn color="var(--fg-muted)" onClick={saveEdits} disabled={saving}>Save</Btn>
            <Btn color="rgba(165,182,214,0.4)" onClick={() => { setContent(item.content); setTitle(item.title ?? ""); setEditing(false); }}>Cancel</Btn>
          </>
        ) : (
          <Btn color="rgba(165,182,214,0.45)" icon={<Edit3 size={12} />} onClick={() => setEditing(true)}>
            Edit <Kbd>E</Kbd>
          </Btn>
        )}

        <Btn
          color={copied ? "#22c55e" : "rgba(165,182,214,0.45)"}
          icon={copied ? <CheckCheck size={12} /> : <Copy size={12} />}
          onClick={() => copy(content)}>
          {copied ? "Copied" : "Copy"}
        </Btn>

        {entry.kind === "review" && !editing && (
          <Btn color="rgba(239,68,68,0.5)" icon={<X size={12} />} onClick={reject}
            title="Reject this content - it won't be posted">
            Skip <Kbd>R</Kbd>
          </Btn>
        )}

        <Link to="/products/$id/distribution" params={{ id: String(item.projectId) }} style={{ textDecoration: "none" }}>
          <Btn color="rgba(165,182,214,0.35)" icon={<ExternalLink size={12} />}>Open</Btn>
        </Link>
      </ActionBar>
    </div>
  );
}

// ── Shared empty / clear states ───────────────────────────────────────────────

export function EmptyPane() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ fontSize: "1.4rem", opacity: 0.2, marginBottom: 4 }}>✦</div>
      <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 500, color: "rgba(165,182,214,0.28)" }}>Select an item</p>
      <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(165,182,214,0.18)" }}>j / k to navigate</p>
    </div>
  );
}

export function AllClearPane() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <div style={{ fontSize: "2rem", marginBottom: 6, opacity: 0.35 }}>✦</div>
      <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "rgba(165,182,214,0.35)" }}>Inbox zero</p>
      <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(165,182,214,0.22)", lineHeight: 1.6, textAlign: "center", maxWidth: 260 }}>
        Nothing pending. Go to a project's Distribution tab to generate content.
      </p>
    </div>
  );
}
