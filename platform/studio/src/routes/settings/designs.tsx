import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getDesignTemplates, createDesignTemplate, updateDesignTemplate, deleteDesignTemplate } from "~/lib/project-fns";
import type { DesignTemplate } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";
import { SectionHeader, LABEL, CARD } from "./-_shared";

export const Route = createFileRoute("/settings/designs")({
  loader: async () => ({ templates: await getDesignTemplates() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DesignsPage,
});

function DesignsPage() {
  const { templates } = Route.useLoaderData() as { templates: DesignTemplate[] };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 680 }}>
        <DesignTemplatesSection initial={templates} />
      </div>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

function TemplateEditor({ name, content, busy, onSave, onCancel }: {
  name: string; content: string; busy: boolean;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [c, setC] = useState(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={LABEL}>Template name</label>
        <input value={n} onChange={e => setN(e.target.value)} placeholder="e.g. Clean Minimal, Bold SaaS, Glassmorphism"
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      </div>
      <div>
        <label style={LABEL}>Design guidelines</label>
        <textarea value={c} onChange={e => setC(e.target.value)} rows={10}
          placeholder={`Describe the visual style for prototype generation.\n\nDo NOT specify: accent/primary color, border-radius, or background - those are set via the controls at the top of the wizard.\n\nDO specify:\n- Typography (Google Font, size scale, weights)\n- Text hierarchy (primary / secondary / muted contrast)\n- Surfaces & cards (flat / bordered / shadowed / glass)\n- Buttons (flat / outlined / filled, hover behavior)\n- Inputs (border style, focus ring)\n- Spacing (compact vs airy)\n- Icons (outline / filled, library)\n- Overall aesthetic\n\nExample:\n"Inter for body, Space Grotesk for headings. Cards with a 1px subtle border, no shadows. Flat primary buttons, outlined secondary. High information density. Muted text at 50% opacity. Linear-inspired - sharp, minimal, developer-focused."`}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem", padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.65 }} />
        <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "rgba(250,250,250,0.25)", fontFamily: "monospace" }}>{c.length.toLocaleString()} chars</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => onSave(n, c)} disabled={busy || !n.trim() || !c.trim()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Prompt box ────────────────────────────────────────────────────────────────

const GENERATE_PROMPT = `You are helping define design guidelines for a micro-SaaS product prototype.

IMPORTANT: The following are controlled separately as live parameters and must NOT be specified in your guidelines:
- Primary / accent color (set via color picker - use "var(--primary)" as a placeholder if needed)
- Border radius (set via radius control - use "var(--r-md)" as a placeholder)
- Background color and dark/light mode (toggled separately)

Write concise design guidelines (200–400 words) covering everything else:

1. **Typography** - font family (pick a Google Font pair), size scale, weight choices, line height
2. **Text hierarchy** - how primary, secondary, and muted text differ (relative contrast, not specific hex values)
3. **Surface & borders** - card style (shadow / border / flat / glass), border opacity/style, divider style
4. **Buttons** - style (flat/outlined/filled), padding, hover behavior (brightness/opacity/color shift)
5. **Form inputs** - border style, focus ring, placeholder opacity
6. **Spacing** - compact or airy? base unit (4px or 8px), section gaps
7. **Icons** - style (outline/filled/duotone), weight, suggested library
8. **Overall aesthetic** - 1–2 sentences: what product does this feel like? (e.g. "Linear-inspired: sharp, minimal, high-density, developer-focused")

Format as clear prose or short bullet points. No code, no hex colors for primary/background/radius. This feeds directly into a prototype generator.`;

function GeneratePromptBox() {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.1)" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
          Prompt to generate guidelines with AI
        </span>
        <Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(GENERATE_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? "✓ Copied" : "Copy prompt"}
        </Button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", fontSize: "0.75rem", color: "var(--fg-subtle)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", background: "rgba(0,0,0,0.15)", maxHeight: 180, overflowY: "auto" }}>
        {GENERATE_PROMPT}
      </pre>
      <div style={{ padding: "8px 14px", fontSize: "0.72rem", color: "rgba(250,250,250,0.3)", borderTop: "1px solid var(--border)" }}>
        Paste this into any AI, then paste the response as a new template above.
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function DesignTemplatesSection({ initial }: { initial: DesignTemplate[] }) {
  const [templates, setTemplates] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function handleSaveEdit(id: number, name: string, content: string) {
    setBusy(true);
    try {
      await updateDesignTemplate({ data: { id, name, content } });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, name, content, updatedAt: new Date() } : t));
      setEditingId(null);
    } finally { setBusy(false); }
  }

  async function handleCreate(name: string, content: string) {
    setBusy(true);
    try {
      const { id } = await createDesignTemplate({ data: { name, content } });
      setTemplates(prev => [...prev, { id, name, content, isDefault: false, createdAt: new Date(), updatedAt: new Date() }]);
      setAdding(false);
    } finally { setBusy(false); }
  }

  async function handleSetDefault(id: number) {
    await updateDesignTemplate({ data: { id, isDefault: true } });
    setTemplates(prev => prev.map(t => ({ ...t, isDefault: t.id === id })));
  }

  async function handleDelete(id: number, name: string) {
    const ok = await confirm(`Delete "${name}"?`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    await deleteDesignTemplate({ data: { id } });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div>
      <SectionHeader
        title="Design Templates"
        desc="Reusable design guidelines that shape how Claude generates prototypes. Describe typography, spacing, component style, and overall aesthetic - not code."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {templates.map(t => (
          <div key={t.id} style={CARD}>
            {editingId === t.id ? (
              <TemplateEditor name={t.name} content={t.content} busy={busy}
                onSave={(name, content) => handleSaveEdit(t.id, name, content)}
                onCancel={() => setEditingId(null)} />
            ) : (
              <div>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--fg)", flex: 1 }}>{t.name}</span>
                  {t.isDefault && (
                    <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid rgba(0,255,136,0.25)", padding: "1px 6px", borderRadius: 3 }}>default</span>
                  )}
                  <div style={{ display: "flex", gap: 5 }}>
                    {!t.isDefault && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(t.id)}>Set default</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditingId(t.id)}>Edit</Button>
                    {templates.length > 1 && !t.isDefault && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id, t.name)}>Delete</Button>
                    )}
                  </div>
                </div>
                {/* Guidelines preview */}
                <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--fg-subtle)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {t.content.length > 280 ? t.content.slice(0, 280) + "…" : t.content}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "0.68rem", color: "rgba(250,250,250,0.22)", fontFamily: "monospace" }}>
                  {t.content.length.toLocaleString()} chars
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div style={CARD}>
          <TemplateEditor name="" content="" busy={busy} onSave={handleCreate} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} style={{ gap: 5, alignSelf: "flex-start" }}>+ New template</Button>
          <GeneratePromptBox />
        </div>
      )}
    </div>
  );
}
