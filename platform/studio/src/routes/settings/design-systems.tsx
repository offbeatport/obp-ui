import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { getDesignSystems, createDesignSystem, updateDesignSystem, deleteDesignSystem } from "~/lib/project-fns";
import type { DesignSystem } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";
import { SectionHeader, LABEL, CARD } from "./-_shared";

export const Route = createFileRoute("/settings/design-systems")({
  loader: async () => ({ systems: await getDesignSystems() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DesignSystemsPage,
});

function DesignSystemsPage() {
  const { systems } = Route.useLoaderData() as { systems: DesignSystem[] };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 720 }}>
        <DesignSystemsSection initial={systems} />
      </div>
    </div>
  );
}

// ── Design Preview (with live controls) ──────────────────────────────────────

const RADIUS_PRESETS = [
  { label: "None", sm: 0, md: 0, pill: 0 },
  { label: "sm", sm: 3, md: 5, pill: 8 },
  { label: "md", sm: 5, md: 8, pill: 20 },
  { label: "lg", sm: 8, md: 14, pill: 30 },
  { label: "pill", sm: 12, md: 20, pill: 999 },
];

function DesignPreview({ html, height = 360 }: { html: string; height?: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [accent, setAccent] = useState("#00ff88");
  const [radiusIdx, setRadiusIdx] = useState(2);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  function applyVars() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const r = RADIUS_PRESETS[radiusIdx];
    doc.documentElement.style.setProperty("--primary", accent);
    doc.documentElement.style.setProperty("--r-sm", `${r.sm}px`);
    doc.documentElement.style.setProperty("--r-md", `${r.md}px`);
    doc.documentElement.style.setProperty("--r-pill", `${r.pill}px`);
    doc.documentElement.setAttribute("data-theme", theme);
  }

  useEffect(() => { applyVars(); }, [accent, radiusIdx, theme]);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        {/* Accent */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.62rem", color: "rgba(250,250,250,0.35)", fontWeight: 600, letterSpacing: "0.06em" }}>ACCENT</span>
          <label style={{ position: "relative", width: 22, height: 22, borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "block", background: accent }}>
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
              style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
          </label>
          <span style={{ fontSize: "0.60rem", fontFamily: "monospace", color: "rgba(250,250,250,0.3)" }}>{accent}</span>
        </div>

        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)" }} />

        {/* Radius */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: "0.62rem", color: "rgba(250,250,250,0.35)", fontWeight: 600, letterSpacing: "0.06em" }}>RADIUS</span>
          {RADIUS_PRESETS.map((r, i) => (
            <button key={r.label} onClick={() => setRadiusIdx(i)} style={{
              padding: "2px 7px", fontSize: "0.62rem", fontWeight: radiusIdx === i ? 700 : 400,
              background: radiusIdx === i ? "rgba(255,255,255,0.08)" : "transparent",
              border: `1px solid ${radiusIdx === i ? "rgba(255,255,255,0.2)" : "var(--border)"}`,
              borderRadius: 3, cursor: "pointer", color: radiusIdx === i ? "var(--fg)" : "var(--fg-subtle)", fontFamily: "inherit",
            }}>{r.label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)" }} />

        {/* Theme */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {(["dark", "light"] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              padding: "2px 8px", fontSize: "0.62rem", fontWeight: theme === t ? 700 : 400,
              background: theme === t ? "rgba(255,255,255,0.08)" : "transparent",
              border: `1px solid ${theme === t ? "rgba(255,255,255,0.2)" : "var(--border)"}`,
              borderRadius: 3, cursor: "pointer", color: theme === t ? "var(--fg)" : "var(--fg-subtle)", fontFamily: "inherit",
            }}>{t === "dark" ? "🌙 Dark" : "☀️ Light"}</button>
          ))}
        </div>
      </div>

      {/* iframe */}
      <div style={{ background: theme === "light" ? "#fff" : "#0d0d0d" }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-scripts"
          onLoad={applyVars}
          style={{ width: "100%", height, border: "none", display: "block" }}
          title="Design system preview"
        />
      </div>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

function SystemEditor({ name, content, busy, onSave, onCancel }: {
  name: string; content: string; busy: boolean;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [c, setC] = useState(content);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setC(ev.target?.result as string); if (!n.trim()) setN(file.name.replace(/\.[^.]+$/, "")); };
    reader.readAsText(file);
  }

  const isHtml = c.trim().startsWith("<");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={LABEL}>System name</label>
        <input value={n} onChange={e => setN(e.target.value)} placeholder="e.g. Clean SaaS, Bold Dashboard, Glassmorphism"
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <label style={{ ...LABEL, marginBottom: 0 }}>HTML design system file</label>
          <input ref={fileRef} type="file" accept=".html,.htm" onChange={handleFile} style={{ display: "none" }} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            ↑ Upload file
          </Button>
        </div>
        <textarea value={c} onChange={e => setC(e.target.value)} rows={14}
          placeholder="Paste the HTML design system file here, or upload above.\n\nThe file should show all base components: headings, body text, buttons (all variants), form inputs, checkboxes, badges, cards.\n\nIMPORTANT: Use CSS variables for the parameters that will be overridden at runtime:\n- --primary (brand color)\n- --r-sm, --r-md, --r-pill (border-radius)\n- --bg, --fg (background/foreground via data-theme attribute)"
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.80rem", padding: "9px 12px", fontFamily: isHtml ? "'JetBrains Mono', monospace" : "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
        <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "rgba(250,250,250,0.25)", fontFamily: "monospace" }}>{c.length.toLocaleString()} chars</p>
      </div>

      {/* Live preview */}
      {isHtml && (
        <div>
          <label style={{ ...LABEL, marginBottom: 8 }}>Preview</label>
          <DesignPreview html={c} height={400} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => onSave(n, c)} disabled={busy || !n.trim() || !c.trim()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Generate prompt ───────────────────────────────────────────────────────────

const GENERATE_PROMPT = `Create a complete single-file HTML design system reference for a micro-SaaS product.

This file shows ALL base UI components so an AI can use it as a reference when building a prototype.

IMPORTANT - these parameters are set separately and MUST use CSS variables (never hardcode them):
- Brand/accent color → always use \`var(--primary)\`
- Border radius → always use \`var(--r-sm)\`, \`var(--r-md)\`, \`var(--r-pill)\`
- Background/foreground → always use \`var(--bg)\`, \`var(--fg)\` toggled via \`data-theme="dark|light"\` on \`<html>\`

Include ALL of these:
1. Typography scale - display, h1, h2, h3, body, small, caption, mono
2. Buttons - primary, secondary, ghost, danger, disabled; small/default/large sizes; icon button
3. Form inputs - text, email, password (with show/hide), textarea, select, disabled state, error state
4. Checkboxes, radio buttons, toggle/switch
5. Badges & tags - default, primary, success, warning, danger
6. Cards - flat, bordered, with shadow
7. Navigation - sidebar item (active/inactive), top nav bar
8. Spacing scale visualization
9. Color palette visualization (using var(--primary) and semantic tokens)

Technical requirements:
- Single HTML file, all CSS in <style>, Google Fonts via <link>
- Support \`data-theme="dark"\` and \`data-theme="light"\` on <html>
- Theme toggle button with id="themeToggle"
- Color picker swatches that update \`--primary\` via JS (so you can preview how components look with different brand colors)
- Self-contained, no external JS libraries

Output ONLY the HTML file, no explanation.`;

function GeneratePromptBox() {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.1)" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
          Prompt to generate a design system with AI
        </span>
        <Button type="button" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(GENERATE_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? "✓ Copied" : "Copy prompt"}
        </Button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", fontSize: "0.74rem", color: "var(--fg-subtle)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", background: "rgba(0,0,0,0.15)", maxHeight: 200, overflowY: "auto" }}>
        {GENERATE_PROMPT}
      </pre>
      <div style={{ padding: "8px 14px", fontSize: "0.72rem", color: "rgba(250,250,250,0.3)", borderTop: "1px solid var(--border)" }}>
        Paste into any AI → get an HTML file → upload it above. The file will be used as the component reference when generating prototypes.
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function DesignSystemsSection({ initial }: { initial: DesignSystem[] }) {
  const [systems, setSystems] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function handleSaveEdit(id: number, name: string, content: string) {
    setBusy(true);
    try {
      await updateDesignSystem({ data: { id, name, content } });
      setSystems(prev => prev.map(s => s.id === id ? { ...s, name, content, updatedAt: new Date() } : s));
      setEditingId(null);
    } finally { setBusy(false); }
  }

  async function handleCreate(name: string, content: string) {
    setBusy(true);
    try {
      const { id } = await createDesignSystem({ data: { name, content } });
      setSystems(prev => [...prev, { id, name, content, isDefault: false, createdAt: new Date(), updatedAt: new Date() }]);
      setAdding(false);
    } finally { setBusy(false); }
  }

  async function handleSetDefault(id: number) {
    await updateDesignSystem({ data: { id, isDefault: true } });
    setSystems(prev => prev.map(s => ({ ...s, isDefault: s.id === id })));
  }

  async function handleDelete(id: number, name: string) {
    const ok = await confirm(`Delete "${name}"?`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    await deleteDesignSystem({ data: { id } });
    setSystems(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div>
      <SectionHeader
        title="Design Systems"
        desc="HTML files showing how base UI components render. Used as a component reference when generating prototypes. Must use CSS variables for color (--primary), radius (--r-md), and theme (data-theme)."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {systems.map(s => (
          <div key={s.id} style={CARD}>
            {editingId === s.id ? (
              <SystemEditor name={s.name} content={s.content} busy={busy}
                onSave={(name, content) => handleSaveEdit(s.id, name, content)}
                onCancel={() => setEditingId(null)} />
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--fg)", flex: 1 }}>{s.name}</span>
                  {s.isDefault && (
                    <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid rgba(0,255,136,0.25)", padding: "1px 6px", borderRadius: 3 }}>default</span>
                  )}
                  <span style={{ fontSize: "0.68rem", color: "rgba(96,165,250,0.6)", border: "1px solid rgba(96,165,250,0.2)", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>HTML</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {!s.isDefault && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(s.id)}>Set default</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditingId(s.id)}>Edit</Button>
                    {systems.length > 1 && !s.isDefault && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id, s.name)}>Delete</Button>
                    )}
                  </div>
                </div>
                {/* Preview */}
                {s.content.trim().startsWith("<") ? (
                  <DesignPreview html={s.content} height={280} />
                ) : (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
                    {s.content.slice(0, 200)}{s.content.length > 200 ? "…" : ""}
                  </p>
                )}
                <p style={{ margin: "6px 0 0", fontSize: "0.68rem", color: "rgba(250,250,250,0.22)", fontFamily: "monospace" }}>
                  {s.content.length.toLocaleString()} chars
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div style={CARD}>
          <SystemEditor name="" content="" busy={busy} onSave={handleCreate} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} style={{ gap: 5, alignSelf: "flex-start" }}>+ New design system</Button>
          <GeneratePromptBox />
        </div>
      )}
    </div>
  );
}
