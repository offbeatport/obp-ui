import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { updateDeployConfig } from "~/lib/build-fns";

interface TechStackOption { id: number; name: string; isDefault: boolean; }

interface ProjectConfig {
  id: number;
  domain?: string | null;
  handle?: string | null;
  twitterHandle?: string | null;
  repoUrl?: string | null;
  coolifyAppId?: string | null;
  techStackId?: number | null;
  designDirection?: string | null;
  deployStatus?: string | null;
}

interface Props {
  open: boolean;
  project: ProjectConfig;
  stacks?: TechStackOption[];
  onClose: () => void;
  onSaved: (patch: Partial<ProjectConfig>) => void;
}

const FIELDS: {
  key: keyof Omit<ProjectConfig, "id">;
  label: string;
  placeholder: string;
  type?: string;
  hint?: string;
}[] = [
    { key: "domain", label: "Domain", placeholder: "yourtool.com", type: "text" },
    { key: "handle", label: "Handle / slug", placeholder: "your-tool", type: "text" },
    { key: "twitterHandle", label: "Twitter / X", placeholder: "@yourhandle", type: "text" },
    { key: "repoUrl", label: "Repository URL", placeholder: "https://github.com/you/repo", type: "url" },
    {
      key: "coolifyAppId", label: "Coolify webhook", placeholder: "https://coolify.yourdomain.com/...", type: "url",
      hint: "Application → Webhooks → Deploy Webhook URL"
    },
  ];

export function ProjectConfigModal({ open, project, stacks, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [stackId, setStackId] = useState<number | null>(null);
  const [designDirection, setDesignDirection] = useState("");
  const [saving, setSaving] = useState(false);
  const [markingLive, setMarkingLive] = useState(false);

  const isLive = project.deployStatus === "deployed";

  // Reset form when opened or project changes
  useEffect(() => {
    if (open) {
      setValues({
        domain: project.domain ?? "",
        handle: project.handle ?? "",
        twitterHandle: project.twitterHandle ?? "",
        repoUrl: project.repoUrl ?? "",
        coolifyAppId: project.coolifyAppId ?? "",
      });
      setStackId(project.techStackId ?? null);
      setDesignDirection(project.designDirection ?? "");
    }
  }, [open, project.id]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function save() {
    setSaving(true);
    try {
      const patch = {
        domain: values.domain?.trim() || undefined,
        handle: values.handle?.trim() || undefined,
        twitterHandle: values.twitterHandle?.trim() || undefined,
        repoUrl: values.repoUrl?.trim() || undefined,
        coolifyAppId: values.coolifyAppId?.trim() || undefined,
        techStackId: stackId,
        designDirection: designDirection.trim() || null,
      };
      await updateDeployConfig({ data: { id: project.id, ...patch } });
      onSaved(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function toggleLive() {
    setMarkingLive(true);
    try {
      const newStatus = isLive ? "draft" : "deployed";
      await updateDeployConfig({ data: { id: project.id, deployStatus: newStatus } });
      onSaved({ deployStatus: newStatus });
    } finally {
      setMarkingLive(false);
    }
  }

  if (!open) return null;

  const LABEL: React.CSSProperties = {
    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "rgba(165,182,214,0.42)",
    marginBottom: 6, display: "block",
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", zIndex: 9001,
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%", maxWidth: 480,
          background: "#0c0c0f",
          border: "1px solid rgba(165,182,214,0.12)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(165,182,214,0.08)",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
              Project configuration
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "rgba(165,182,214,0.45)", lineHeight: 1.4 }}>
              Required for deployment and distribution features
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="pcm-close"
            style={{ padding: "4px" }}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Live status */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px",
            background: isLive ? "rgba(34,197,94,0.06)" : "rgba(165,182,214,0.04)",
            border: `1px solid ${isLive ? "rgba(34,197,94,0.2)" : "rgba(165,182,214,0.1)"}`,
            borderRadius: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isLive ? "var(--success)" : "rgba(165,182,214,0.3)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: "0.82rem", color: isLive ? "var(--success)" : "rgba(165,182,214,0.5)", fontWeight: 500 }}>
                {isLive ? "Live" : "Building"}
              </span>
              {isLive && values.domain && (
                <a
                  href={values.domain.startsWith("http") ? values.domain : `https://${values.domain}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: "0.76rem", color: "rgba(34,197,94,0.6)", textDecoration: "none" }}
                >
                  {values.domain} ↗
                </a>
              )}
              {!isLive && (
                <span style={{ fontSize: "0.74rem", color: "rgba(165,182,214,0.3)" }}>
                  Set a domain below, then mark as live
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLive}
              disabled={markingLive || (!isLive && !values.domain?.trim())}
            >
              {markingLive ? "…" : isLive ? "Mark as building" : "Mark as live"}
            </Button>
          </div>

          {/* Design direction */}
          <div>
            <label style={LABEL}>
              Design Direction
              {!designDirection.trim() && <span style={{ marginLeft: 6, color: "#f59e0b", fontSize: "0.60rem" }}>⚠ not set</span>}
            </label>
            <textarea
              value={designDirection}
              onChange={e => setDesignDirection(e.target.value)}
              placeholder="Describe the visual direction - tone, colors, component style, inspiration. E.g. 'Dark, minimal, monospace, like Linear or Raycast. Accent #00ff88. No gradients.'"
              rows={4}
              style={{ width: "100%", background: "var(--bg-elevated)", border: `1px solid ${!designDirection.trim() ? "rgba(245,158,11,0.3)" : "rgba(165,182,214,0.12)"}`, borderRadius: 4, color: "var(--fg-muted)", fontSize: "0.82rem", padding: "9px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.65 }}
            />
          </div>

          {FIELDS.map(({ key, label, placeholder, type, hint }) => (
            <div key={key}>
              <label style={LABEL}>{label}</label>
              <Input
                type={type ?? "text"}
                value={values[key] ?? ""}
                onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%" }}
              />
              {hint && (
                <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "rgba(165,182,214,0.32)", lineHeight: 1.5 }}>
                  {hint}
                </p>
              )}
            </div>
          ))}
          {stacks && stacks.length > 0 && (
            <div>
              <label style={LABEL}>Tech Stack</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {stacks.map(s => {
                  const effectiveId = stackId ?? stacks.find(x => x.isDefault)?.id ?? stacks[0]?.id;
                  const selected = effectiveId === s.id;
                  return (
                    <div key={s.id} onClick={() => setStackId(s.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${selected ? "rgba(0,255,136,0.4)" : "rgba(165,182,214,0.1)"}`, borderRadius: 4, cursor: "pointer", background: selected ? "rgba(0,255,136,0.04)" : "transparent", transition: "border-color 0.1s" }}
                    >
                      <div style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${selected ? "var(--accent)" : "rgba(165,182,214,0.3)"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {selected && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)" }} />}
                      </div>
                      <span style={{ fontSize: "0.84rem", fontWeight: 500, color: selected ? "var(--fg)" : "rgba(165,182,214,0.6)", flex: 1 }}>{s.name}</span>
                      {s.isDefault && <span style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>default</span>}
                    </div>
                  );
                })}
              </div>
              <a href="/settings#tech-stacks" target="_blank" rel="noreferrer" className="pcm-link" style={{ display: "inline-block", marginTop: 8, fontSize: "0.70rem", color: "rgba(165,182,214,0.35)", textDecoration: "none", transition: "color 0.1s" }}
              >Manage stacks →</a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: 8, padding: "14px 20px",
          borderTop: "1px solid rgba(165,182,214,0.08)",
          flexShrink: 0,
        }}>
          <Button variant="primary" size="sm" onClick={save} disabled={saving} style={{ gap: 6 }}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Compact config summary (for overview page) ────────────────────────────────

export function ProjectConfigSummary({ project, onConfigure }: {
  project: ProjectConfig;
  onConfigure: () => void;
}) {
  const items = [
    project.domain && { label: project.domain, link: project.domain.startsWith("http") ? project.domain : `https://${project.domain}` },
    project.handle && { label: project.handle },
    project.twitterHandle && { label: project.twitterHandle, link: `https://x.com/${project.twitterHandle.replace("@", "")}` },
    project.repoUrl && { label: "Repo", link: project.repoUrl },
  ].filter(Boolean) as { label: string; link?: string }[];

  return (
    <div style={{
      marginTop: 32, paddingTop: 20,
      borderTop: "1px solid rgba(165,182,214,0.07)",
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", flexShrink: 0 }}>
        Config
      </span>
      {items.length > 0 ? (
        <>
          {items.map(({ label, link }) =>
            link ? (
              <a key={label} href={link} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="pcm-link"
                style={{ fontSize: "0.78rem", color: "rgba(165,182,214,0.55)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, transition: "color 0.1s" }}
              >
                {label}<ExternalLink size={9} style={{ opacity: 0.5 }} />
              </a>
            ) : (
              <span key={label} style={{ fontSize: "0.78rem", color: "rgba(165,182,214,0.55)" }}>{label}</span>
            )
          )}
          <span style={{ color: "rgba(165,182,214,0.2)", fontSize: "0.70rem" }}>·</span>
        </>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={onConfigure}
        className="pcm-configure-btn"
        style={{ padding: 0, fontSize: "0.76rem" }}
      >
        {items.length > 0 ? "Edit config →" : "Configure project →"}
      </Button>
    </div>
  );
}
