import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Hammer, Rocket, Copy, Check, Plus, Trash2, ExternalLink, ChevronDown, ChevronUp,
  CreditCard, Zap, ArrowRight, ArrowLeft, RefreshCw,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";
import { Input } from "~/components/ui/Input";
import { ProjectConfigModal } from "~/components/ui/ProjectConfigModal";
import { useProjectContext } from "~/lib/project-context";
import { getOpportunitiesForSelect } from "~/lib/distribution-fns";
import type { OppForSelect } from "~/lib/distribution-fns";
import {
  getProjectFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  updateDeployConfig,
  updateMonetizeConfig,
} from "~/lib/build-fns";
import { generateAndCreateOpportunity, selectOpportunityToBuild, getProjectVersions, markVersionShipped, createProjectVersion, cancelProjectVersion, getDeployedFeatures, markFeatureRemoved, resetV0Init, resetProject } from "~/lib/server-fns";
import { InitWizard } from "./-init-wizard";
import { updateProject } from "~/lib/project-fns";
import { getTechStacks, getFounderProfile, getDesignTemplates, getDesignSystems } from "~/lib/project-fns";
import type { Feature } from "~/lib/build-fns";
import type { TechStack, DesignTemplate, DesignSystem } from "~/db/schema";
import { SectionLabel } from "../$id";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/products/$id/build")({
  loader: async ({ params }) => {
    const productId = parseInt(params.id, 10);
    const { getProduct } = await import("~/lib/product-fns");
    const product = await getProduct({ data: { id: productId } });
    const ideaId = product?.ideaId ?? 0;
    const [features, opps, stacks, designTemplates, designSystems, versions, deployedFeatures, founderProfile] = await Promise.all([
      productId ? getProjectFeatures({ data: { productId } }) : Promise.resolve([]),
      ideaId ? getOpportunitiesForSelect({ data: { projectId: ideaId } }) : Promise.resolve([]),
      getTechStacks(),
      getDesignTemplates(),
      getDesignSystems(),
      productId ? getProjectVersions({ data: { productId } }) : Promise.resolve([]),
      productId ? getDeployedFeatures({ data: { productId } }) : Promise.resolve([]),
      getFounderProfile(),
    ]);
    return {
      product,
      productId,
      features,
      opportunities: opps.filter((o) => o.insightsJson != null && o.status === "building"),
      allOpportunities: opps.filter((o) => o.insightsJson != null),
      stacks,
      designTemplates,
      designSystems,
      versions,
      deployedFeatures,
      founderProfile,
    };
  },
  staleTime: 10_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: BuildPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ORDER = ["idea", "specced", "building", "built", "launched"] as const;
type FeatureStatus = typeof STATUS_ORDER[number];

const STATUS_LABELS: Record<FeatureStatus, string> = {
  idea: "Idea",
  specced: "Specced",
  building: "Building",
  built: "Built",
  launched: "Launched",
};

const STATUS_COLORS: Record<FeatureStatus, string> = {
  idea: "var(--fg-subtle)",
  specced: "rgba(165,182,214,0.7)",
  building: "var(--accent)",
  built: "#60a5fa",
  launched: "#22c55e",
};

// ── Design prompt generator ───────────────────────────────────────────────────

function buildDesignPrompt(projectName: string, opp: OppForSelect | null, designDirection?: string | null): string {
  const ins = opp?.insightsJson;
  const buyer = ins?.buyer_persona ?? "solopreneurs and small teams";
  const features = ins?.v1_features?.slice(0, 5) ?? [];
  const fl = features.map((f) => `  - ${f}`).join("\n");
  const direction = designDirection?.trim() || "Dark, minimal, high-contrast. Accent #00ff88. React + inline styles.";

  return `Design a production-ready UI for "${projectName}" - a tool built for ${buyer}.

Context:
${opp ? `- Pain: ${opp.painSummary}` : ""}
- Community: ${opp?.community ?? "indie hackers / solopreneurs"}
${fl ? `\nV1 Features:\n${fl}` : ""}

Design direction:
${direction}

Produce a complete, working React component for the main dashboard/home page.
Include proper data visualization, empty states, and responsive layout.`.trim();
}

// ── Build prompt generator ────────────────────────────────────────────────────

function buildClaudeCodePrompt(
  projectName: string,
  opp: OppForSelect | null,
  featureList: Feature[],
): string {
  const ins = opp?.insightsJson;
  const buyer = ins?.buyer_persona ?? "solopreneurs";
  const hidden = ins?.hidden_need;
  const self = ins?.self_growth;
  const price = ins?.price_anchor;
  const moat = ins?.niche_signal;
  const mrrLow = ins?.mrr_low;
  const mrrHigh = ins?.mrr_high;
  const v1Features = ins?.v1_features ?? [];

  const featuresToBuild = featureList.filter((f) => f.status !== "built" && f.status !== "launched");
  const featureLines = (featuresToBuild.length > 0 ? featuresToBuild : featureList)
    .map((f) => `  - ${f.title}${f.buildSpec ? `: ${f.buildSpec.slice(0, 100)}` : ""}`)
    .join("\n");

  const v1Lines = v1Features.map((f) => `  - ${f}`).join("\n");

  return `/build-opportunity

## Product: ${projectName}

### Pain
${opp?.painSummary ?? ""}
${hidden ? `\nHidden need: ${hidden}` : ""}

### Buyer
${buyer}

### Opportunity V1 Features (from analysis)
${v1Lines || "  - (no features listed in opportunity)"}

### Features to Build (from backlog)
${featureLines || "  - (no features in backlog yet)"}

${self ? `### Self-growth\n${self}\n` : ""}
${moat ? `### Moat\n${moat}\n` : ""}
${price ? `### WTP / Price signal\n${price}\n` : ""}
${mrrLow && mrrHigh ? `### Revenue target\n$${mrrLow.toLocaleString()}–$${mrrHigh.toLocaleString()}/mo MRR\n` : ""}

### Tech Stack
- TanStack Start + React + inline styles (no Tailwind)
- SQLite + Drizzle ORM
- Server functions via createServerFn
- Vite config API routes for background jobs

### Instructions
1. Build the V1 features listed above as a working, deployable product
2. Follow the existing project patterns (Button component, CSS variables, project-fns.ts pattern)
3. Create server functions for any new data operations
4. Keep it simple - ship working code, not perfect code
5. The goal is a product users can pay for within a week`.trim();
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy", style: extraStyle }: { text: string; label?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      style={{ gap: 6, border: "1px solid var(--border-strong)", color: copied ? "var(--accent)" : "var(--fg-muted)", ...extraStyle }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ── FeatureRow ────────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  onUpdate,
  onDelete,
}: {
  feature: Feature;
  onUpdate: (patch: Partial<Feature>) => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [editSpec, setEditSpec] = useState(feature.buildSpec ?? "");
  const [specBusy, setSpecBusy] = useState(false);

  async function cycleStatus() {
    const idx = STATUS_ORDER.indexOf(feature.status as FeatureStatus);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    await updateFeature({ data: { id: feature.id, status: next } });
    onUpdate({ status: next });
  }

  async function saveSpec() {
    setSpecBusy(true);
    try {
      await updateFeature({ data: { id: feature.id, buildSpec: editSpec } });
      onUpdate({ buildSpec: editSpec });
    } finally {
      setSpecBusy(false);
    }
  }

  const statusColor = STATUS_COLORS[feature.status as FeatureStatus] ?? "var(--fg-subtle)";
  const statusLabel = STATUS_LABELS[feature.status as FeatureStatus] ?? feature.status;

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-[10px] h-[40px] px-3">
        {/* Title */}
        <span className="flex-1 text-sm text-fg-muted overflow-hidden text-ellipsis whitespace-nowrap">
          {feature.title}
        </span>

        {/* Hours badge */}
        {feature.estimatedHours != null && (
          <span
            className="text-[0.68rem] text-fg-subtle rounded-[3px] px-[7px] py-[1px] flex-shrink-0 border border-border"
            style={{ background: "rgba(165,182,214,0.06)" }}
          >
            ~{feature.estimatedHours}h
          </span>
        )}

        {/* Expand / actions */}
        <div className="flex gap-1 items-center pr-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            style={{ height: "auto", padding: "4px 6px", border: "1px solid var(--border-strong)", color: "var(--fg-subtle)" }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { const ok = await confirm(`Delete "${feature.title}"?`, { variant: "danger", confirmLabel: "Delete" }); if (ok) onDelete(); }}
            style={{ height: "auto", padding: "4px 6px", border: "1px solid var(--border-strong)", color: "var(--fg-subtle)" }}
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      {/* Expanded spec editor */}
      {expanded && (
        <div
          className="px-3 pb-3"
          style={{ background: "rgba(165,182,214,0.02)" }}
        >
          <textarea
            value={editSpec}
            onChange={(e) => setEditSpec(e.target.value)}
            placeholder="Spec / notes for this feature…"
            rows={4}
            className="w-full text-fg-muted text-xs leading-[1.6] p-[10px] font-[inherit] resize-y outline-none box-border mb-2 rounded-[var(--radius)]"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={saveSpec}
            disabled={specBusy}
            style={{ border: "1px solid var(--border-strong)", color: "var(--accent)" }}
          >
            {specBusy ? "Saving…" : "Save spec"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── AddFeatureRow ─────────────────────────────────────────────────────────────

function AddFeatureRow({
  productId,
  opportunityId,
  onAdded,
  onCancel,
}: {
  productId: number;
  opportunityId: number | null;
  onAdded: (f: Feature) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { id } = await createFeature({
        data: {
          productId,
          title: title.trim(),
          estimatedHours: hours ? parseFloat(hours) : undefined,
          opportunityId: opportunityId ?? undefined,
        },
      });
      onAdded({
        id,
        productId,
        opportunityId: opportunityId ?? null,
        title: title.trim(),
        buildSpec: null,
        techStack: null,
        removedInVersionId: null,
        status: "idea",
        estimatedHours: hours ? parseFloat(hours) : null,
        actualHours: null,
        buildSessionRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex gap-2 items-center px-3 py-2 border-b border-border"
      style={{ background: "rgba(165,182,214,0.025)" }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Feature title…"
        style={{ flex: 1, height: 30, padding: "4px 8px", fontSize: "0.82rem" }}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={saving || !title.trim()}
      >
        {saving ? "…" : "Add"}
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel}>×</Button>
    </div>
  );
}

// ── BuildSubTab ───────────────────────────────────────────────────────────────

function BuildSubTab({
  project,
  productId,
  opportunities,
  features: initialFeatures,
  stacks,
  onConfigure,
}: {
  project: { id: number; name: string; techStackId?: number | null; designDirection?: string | null };
  productId: number;
  opportunities: OppForSelect[];
  features: Feature[];
  stacks: TechStack[];
  onConfigure: () => void;
}) {
  const showConfirm = useConfirm();
  const navigate = useNavigate();
  const buildingOpps = opportunities.filter((o) => o.status === "building");
  const [oppId, setOppId] = useState<number | null>(
    buildingOpps[0]?.id ?? null
  );

  // New opportunity inline form (shown in empty state)
  const [newOppDesc, setNewOppDesc] = useState("");
  const [newOppGenerating, setNewOppGenerating] = useState(false);
  const [newOppError, setNewOppError] = useState("");

  async function handleCreateAndBuild() {
    if (!newOppDesc.trim()) return;
    setNewOppGenerating(true);
    setNewOppError("");
    try {
      const result = await generateAndCreateOpportunity({ data: { projectId: project.id, description: newOppDesc.trim() } });
      const { createProduct } = await import("~/lib/product-fns");
      const { id: productId } = await createProduct({ data: { ideaId: project.id, opportunityId: result.id } });
      await selectOpportunityToBuild({ data: { productId, opportunityId: result.id } });
      setOppId(result.id);
      setNewOppDesc("");
    } catch (err: any) {
      setNewOppError(err.message ?? "Failed to create opportunity");
    } finally {
      setNewOppGenerating(false);
    }
  }
  const [featureList, setFeatureList] = useState<Feature[]>(initialFeatures);
  const [adding, setAdding] = useState(false);

  // Collapsible secondary sections
  const [designOpen, setDesignOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  // Design step
  const [designOutput, setDesignOutput] = useState("");

  const CUSTOM_KEY = `custom-prompt-${project.id}`;
  const [customPrompt, setCustomPrompt] = useState("");

  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem(CUSTOM_KEY);
      if (savedCustom) setCustomPrompt(savedCustom);
    } catch { }
  }, [CUSTOM_KEY]);

  // Resolve the project's tech stack (falls back to default)
  const defaultStack = stacks.find(s => s.isDefault) ?? stacks[0] ?? null;
  const selectedStack = stacks.find(s => s.id === project.techStackId) ?? defaultStack;
  const techStackString = selectedStack?.content ?? "";

  // Build state - subscribe to /api/builds-stream for live updates
  const [activeBuild, setActiveBuild] = useState<any>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/builds-list")
      .then(r => r.json())
      .then((list: any[]) => {
        const match = list.find((b: any) => b.opportunityId === oppId && (b.status === "running" || b.status === "dev:starting" || b.status === "dev:ready"));
        if (match) { setActiveBuild(match); setBuildLogs(match.logs || []); }
      }).catch(() => { });
  }, [oppId]);

  // Only open SSE when a build is actively running - avoids consuming a connection slot permanently
  const isActiveBuildRunning = activeBuild?.status === "running" || activeBuild?.status === "dev:starting";
  useEffect(() => {
    if (!isActiveBuildRunning) return;
    const es = new EventSource("/api/builds-stream");
    es.onmessage = (e) => {
      try {
        const { build } = JSON.parse(e.data);
        if (build && build.opportunityId === oppId) {
          setActiveBuild(build);
          setBuildLogs(build.logs || []);
        }
      } catch { }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [isActiveBuildRunning, oppId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [buildLogs.length]);

  const selectedOpp = opportunities.find((o) => o.id === oppId) ?? null;
  const ins = selectedOpp?.insightsJson ?? null;
  const designPrompt = buildDesignPrompt(project.name, selectedOpp, project.designDirection);
  const buildPrompt = buildClaudeCodePrompt(project.name, selectedOpp, featureList);

  async function seedFeaturesFromOpp() {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp?.insightsJson?.v1_features) return;
    if (featureList.length > 0) {
      const ok = await showConfirm("Replace current feature list with features from this opportunity?", { confirmLabel: "Replace" });
      if (!ok) return;
      await Promise.all(featureList.map((f) => deleteFeature({ data: { id: f.id } })));
    }
    const ins = opp.insightsJson;
    const context = [
      `Product: ${opp.title}`,
      `Pain: ${opp.painSummary}`,
      ins.hidden_need ? `Hidden need: ${ins.hidden_need}` : null,
      ins.buyer_persona ? `Buyer: ${ins.buyer_persona}` : null,
    ].filter(Boolean).join("\n");

    const created: Feature[] = [];
    for (const title of opp.insightsJson.v1_features.slice(0, 8)) {
      const { id } = await createFeature({ data: { productId, title, buildSpec: context, opportunityId: opp.id } });
      created.push({ id, productId, opportunityId: opp.id, title, buildSpec: context, techStack: null, removedInVersionId: null, status: "idea", estimatedHours: null, actualHours: null, buildSessionRef: null, createdAt: new Date(), updatedAt: new Date() });
    }
    setFeatureList(created);
  }

  async function startBuild() {
    if (!oppId) return;
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp) return;
    const url = new URL("/api/build-opportunity", window.location.origin);
    url.searchParams.set("id", String(oppId));
    url.searchParams.set("title", opp.title);
    url.searchParams.set("projectId", String(project.id));
    if (designOutput.trim()) url.searchParams.set("designOutput", designOutput.trim());
    if (techStackString.trim()) url.searchParams.set("techStack", techStackString.trim());
    if (customPrompt.trim()) url.searchParams.set("customPrompt", customPrompt.trim());
    // Fire and forget - SSE stream will provide updates
    fetch(url.toString()).catch(() => { });
    setActiveBuild({ status: "running", logs: [] });
    setBuildLogs([]);
  }

  const totalH = featureList.reduce((s, f) => s + (f.estimatedHours ?? 0), 0);
  const doneCount = featureList.filter((f) => f.status === "built" || f.status === "launched").length;
  const isBuilding = activeBuild?.status === "running" || activeBuild?.status === "dev:starting";
  const builtCount = opportunities.filter(o => o.status === "built").length;
  const currentVersionNumber = builtCount + 1;
  const isLive = activeBuild?.status === "dev:ready";


  // ── Empty state - no opportunity currently building ──────────────────────────
  if (buildingOpps.length === 0 && !oppId) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px", gap: 0 }}>
        <Hammer size={36} style={{ color: "var(--accent)", opacity: 0.4, marginBottom: 20 }} />
        <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Nothing to build yet
        </h3>
        <p style={{ margin: "0 0 32px", fontSize: "0.86rem", color: "var(--fg-subtle)", lineHeight: 1.6, textAlign: "center", maxWidth: 360 }}>
          Select an existing opportunity and click "Build This", or describe a new one below and let AI generate it.
        </p>

        {/* CTA: go to opportunities */}
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate({ to: "/i/$id/opportunities", params: { id: String(project.id) }, search: { opp: undefined } })}
          style={{ marginBottom: 32, border: "1px solid var(--accent)", color: "var(--accent)", background: "rgba(96,165,250,0.1)" }}
        >
          Browse Opportunities <ArrowRight size={14} />
        </Button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: 480, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>OR CREATE NEW</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Inline new opportunity form */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={newOppDesc}
            onChange={e => setNewOppDesc(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreateAndBuild(); }}
            placeholder="Describe the opportunity - persona, pain, existing tools that fail them. AI will generate the full analysis and start the build…"
            rows={5}
            disabled={newOppGenerating}
            style={{
              width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem",
              padding: "12px 14px", fontFamily: "inherit", resize: "vertical", outline: "none",
              boxSizing: "border-box", lineHeight: 1.65,
            }}
          />
          {newOppError && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(239,68,68,0.8)" }}>{newOppError}</p>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateAndBuild}
            disabled={newOppGenerating || !newOppDesc.trim()}
            style={{ alignSelf: "flex-start" }}
          >
            {newOppGenerating
              ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
              : <><Zap size={13} /> Generate & Build</>}
          </Button>
        </div>
      </div>
    );
  }

  const secBtn: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
    background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
    textAlign: "left" as const,
  };
  const secLabel: React.CSSProperties = {
    fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const,
    color: "var(--fg-subtle)", flex: 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

      {/* Setup nudge - shown when design direction or tech stack not configured */}
      {(!project.designDirection || !project.techStackId) && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(245,158,11,0.2)", padding: "7px 24px", background: "rgba(245,158,11,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.66rem", color: "#f59e0b" }}>⚠</span>
          <span style={{ fontSize: "0.76rem", color: "rgba(245,158,11,0.8)", flex: 1 }}>
            {[!project.designDirection && "Design direction", !project.techStackId && "Tech stack"].filter(Boolean).join(" and ")} not configured - your build prompts will use defaults.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onConfigure}
            style={{ border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontSize: "0.74rem", height: "auto", padding: "3px 10px" }}
          >
            Configure →
          </Button>
        </div>
      )}

      {/* Opportunity context strip */}
      {selectedOpp && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", padding: "9px 24px", display: "flex", alignItems: "center", gap: 16, background: "rgba(96,165,250,0.025)" }}>
          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>
            {selectedOpp.title}
          </span>
          <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
            <span style={{ fontSize: "0.70rem", fontWeight: 600, color: selectedOpp.scoreTotal >= 7 ? "var(--accent)" : selectedOpp.scoreTotal >= 5 ? "#f59e0b" : "#ef4444" }}>
              {selectedOpp.scoreTotal.toFixed(1)}
            </span>
            {ins?.mrr_low && ins?.mrr_high && (
              <span style={{ fontSize: "0.70rem", color: "rgba(250,250,250,0.45)" }}>
                ${(ins.mrr_low / 1000).toFixed(0)}k–${(ins.mrr_high / 1000).toFixed(0)}k MRR
              </span>
            )}
            {ins?.buyer_persona && (
              <span style={{ fontSize: "0.70rem", color: "rgba(250,250,250,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {ins.buyer_persona}
              </span>
            )}
          </div>
          <a href={`/opportunity/${selectedOpp.id}`} style={{ marginLeft: "auto", fontSize: "0.68rem", color: "rgba(250,250,250,0.3)", textDecoration: "none", flexShrink: 0 }}
          >View →</a>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Section 1: Features */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Features</span>
              {featureList.length > 0 && (
                <span style={{ marginLeft: 12, fontSize: "0.68rem", color: "var(--fg-subtle)", border: "1px solid var(--border)", padding: "1px 7px", borderRadius: 3 }}>
                  {doneCount}/{featureList.length}{totalH > 0 ? ` · ~${totalH}h` : ""}
                </span>
              )}
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {ins?.v1_features && ins.v1_features.length > 0 && featureList.length === 0 && (
                  <Button variant="outline" size="sm" onClick={seedFeaturesFromOpp} style={{ border: "1px solid var(--border-strong)", color: "var(--accent)", flexShrink: 0 }}>
                    Import from analysis
                  </Button>
                )}
                {!adding && (
                  <Button variant="outline" size="sm" onClick={() => setAdding(true)} style={{ gap: 5, border: "1px solid var(--border-strong)", color: "var(--accent)" }}>
                    <Plus size={12} /> Add
                  </Button>
                )}
              </div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {adding && (
                <AddFeatureRow
                  productId={productId}
                  opportunityId={oppId}
                  onAdded={f => { setFeatureList(prev => [f, ...prev]); setAdding(false); }}
                  onCancel={() => setAdding(false)}
                />
              )}
              {featureList.length === 0 && !adding ? (
                <div style={{ padding: "24px", textAlign: "center", fontSize: "0.82rem", color: "var(--fg-subtle)" }}>
                  No features yet. Import from analysis or add manually.
                </div>
              ) : (
                featureList.map(f => (
                  <FeatureRow
                    key={f.id}
                    feature={f}
                    onUpdate={patch => setFeatureList(prev => prev.map(x => x.id === f.id ? { ...x, ...patch } : x))}
                    onDelete={async () => { await deleteFeature({ data: { id: f.id } }); setFeatureList(prev => prev.filter(x => x.id !== f.id)); }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Secondary sections - collapsible */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 24 }}>

            {/* Design */}
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <Button variant="ghost" size="sm" onClick={() => setDesignOpen(v => !v)} style={{ ...secBtn, height: "auto", borderRadius: 0 }}>
                <span style={secLabel}>Design</span>
                {designOutput.trim() && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
                <ChevronDown size={12} style={{ color: "var(--fg-subtle)", transform: designOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
              </Button>
              {designOpen && (
                <div style={{ padding: "4px 14px 14px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                    <CopyButton text={designPrompt} label="Copy design prompt" style={{ color: "var(--accent)", border: "1px solid rgba(96,165,250,0.35)" }} />
                    <a href="https://claude.ai/design" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <Button variant="ghost" size="sm" style={{ gap: 5, border: "1px solid var(--border-strong)", color: "var(--fg-subtle)" }}>
                        <ExternalLink size={11} /> Open claude.ai/design
                      </Button>
                    </a>
                  </div>
                  <textarea value={designOutput} onChange={e => setDesignOutput(e.target.value)}
                    placeholder="Paste your claude.ai/design output here (React component, HTML, or design spec)…" rows={6}
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem", padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              )}
            </div>

            {/* Additional Context */}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setContextOpen(v => !v)} style={{ ...secBtn, height: "auto", borderRadius: 0 }}>
                <span style={secLabel}>Additional Context</span>
                {customPrompt.trim() && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
                <ChevronDown size={12} style={{ color: "var(--fg-subtle)", transform: contextOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0, marginLeft: 6 }} />
              </Button>
              {contextOpen && (
                <div style={{ padding: "4px 14px 14px", borderTop: "1px solid var(--border)" }}>
                  <textarea
                    value={customPrompt}
                    onChange={e => { setCustomPrompt(e.target.value); try { localStorage.setItem(CUSTOM_KEY, e.target.value); } catch { } }}
                    placeholder="Edge cases, constraints, or extra context for the agent…"
                    rows={4}
                    style={{ width: "100%", marginTop: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem", padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Build logs */}
          {buildLogs.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Build Output</span>
                {isLive && activeBuild?.devUrl && (
                  <a href={activeBuild.devUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                    <ExternalLink size={10} /> Open App
                  </a>
                )}
              </div>
              <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--border)", borderLeft: `2px solid ${isLive ? "var(--accent)" : isBuilding ? "#f59e0b" : activeBuild?.status === "failed" ? "#ef4444" : "var(--border)"}`, padding: "12px 14px", maxHeight: 320, overflowY: "auto", fontFamily: "inherit", fontSize: "0.78rem", lineHeight: 1.65 }}>
                {buildLogs.map((line, i) => {
                  const c = line.startsWith("═") || line.startsWith("BUILD") ? "#f59e0b" : line.startsWith("✓") ? "var(--accent)" : line.startsWith("✗") || line.includes("error") ? "#ef4444" : /http:\/\/localhost/.test(line) ? "var(--accent)" : "rgba(250,250,250,0.62)";
                  return <div key={i} style={{ color: c, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</div>;
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky build footer */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "10px 32px", background: "var(--bg)", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 8 }}>

          {/* Primary: Build */}
          <Button
            variant="primary"
            size="md"
            onClick={startBuild}
            disabled={!oppId || isBuilding}
            style={isBuilding ? { background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" } : undefined}
          >
            {isBuilding
              ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", animation: "pulse 1.5s infinite", flexShrink: 0 }} /> Building…</>
              : <><Hammer size={13} /> Build v{currentVersionNumber}</>}
          </Button>

          {/* Open Local - only shown if build is live */}
          {activeBuild?.devUrl && (
            <a href={activeBuild.devUrl} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", fontWeight: 500, textDecoration: "none", fontFamily: "inherit" }}
            >
              <ExternalLink size={12} /> Open Local
            </a>
          )}

          {/* Stack info */}
          {selectedStack && (
            <span style={{ fontSize: "0.70rem", color: "rgba(250,250,250,0.28)", paddingLeft: 4 }}>
              {selectedStack.name}
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <CopyButton text={buildPrompt} label="Copy prompt" style={{ border: "1px solid var(--border-strong)", color: "var(--fg-subtle)", fontSize: "0.70rem" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeploySubTab ──────────────────────────────────────────────────────────────

function DeploySubTab({ project, onUpdated }: { project: any; onUpdated: (patch: any) => void }) {
  const [configOpen, setConfigOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState<string | null>(null);

  const deployStatus = project.deployStatus ?? "draft";

  const STATUS_COLOR: Record<string, string> = {
    draft: "var(--fg-subtle)",
    deploying: "var(--accent)",
    deployed: "#22c55e",
    failed: "#ef4444",
  };

  const webhookUrl = project.coolifyAppId ?? "";

  async function handleDeploy() {
    if (!webhookUrl.trim()) {
      setDeployLog("⚠ Configure a Coolify webhook URL first (click Configure below).");
      return;
    }
    setDeploying(true);
    setDeployLog("Triggering deploy…");
    await updateDeployConfig({ data: { id: project.id, deployStatus: "deploying" } });
    onUpdated({ deployStatus: "deploying" });
    try {
      const res = await fetch("/api/coolify-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      if (res.ok) {
        const json = await res.json() as any;
        setDeployLog(`✓ Deploy triggered. ${json.message ?? ""}`);
        await updateDeployConfig({ data: { id: project.id, deployStatus: "deployed" } });
        onUpdated({ deployStatus: "deployed" });
      } else {
        const text = await res.text();
        setDeployLog(`✗ Deploy failed: ${text}`);
        await updateDeployConfig({ data: { id: project.id, deployStatus: "failed" } });
        onUpdated({ deployStatus: "failed" });
      }
    } catch (err: any) {
      setDeployLog(`✗ Network error: ${err?.message}`);
      await updateDeployConfig({ data: { id: project.id, deployStatus: "failed" } });
      onUpdated({ deployStatus: "failed" });
    } finally {
      setDeploying(false);
    }
  }

  const domain = project.domain ?? "";

  return (
    <div className="overflow-y-auto flex-1 px-6 py-5 pb-8">
      <div className="max-w-[480px]">

        {/* Status */}
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: STATUS_COLOR[deployStatus] ?? "var(--fg-subtle)" }} />
          <span className="text-sm text-fg-subtle font-semibold uppercase tracking-widest">{deployStatus}</span>
          {deployStatus === "deployed" && domain && (
            <a href={domain.startsWith("http") ? domain : `https://${domain}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-accent text-sm">
              {domain} →
            </a>
          )}
        </div>

        {/* Deploy button */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <Button
            variant="outline" size="sm" onClick={handleDeploy}
            disabled={deploying || !webhookUrl.trim()}
            style={{ gap: 6, border: `1px solid ${deploying ? "var(--border-strong)" : "rgba(34,197,94,0.4)"}`, color: deploying ? "var(--fg-subtle)" : "#22c55e" }}
          >
            <Rocket size={13} />
            {deploying ? "Deploying…" : "Deploy to Coolify"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)} style={{ color: "rgba(165,182,214,0.5)", fontSize: "0.78rem" }}>
            Configure project →
          </Button>
        </div>

        {!webhookUrl && (
          <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "rgba(165,182,214,0.4)", lineHeight: 1.5 }}>
            No Coolify webhook configured yet.{" "}
            <button onClick={() => setConfigOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "inherit", fontFamily: "inherit", padding: 0 }}>
              Configure →
            </button>
          </p>
        )}

        {deployLog && (
          <div className="px-3 py-[10px] text-xs text-fg-muted font-mono leading-[1.6] border border-border" style={{ background: "var(--bg-elevated)" }}>
            {deployLog}
          </div>
        )}
      </div>

      <ProjectConfigModal
        open={configOpen}
        project={project}
        onClose={() => setConfigOpen(false)}
        onSaved={(patch) => onUpdated(patch)}
      />
    </div>
  );
}

// ── MonetizeSubTab ────────────────────────────────────────────────────────────

const PROCESSORS = [
  { key: "polar", label: "Polar.sh", url: "https://polar.sh", desc: "OSS-friendly, built for developers" },
  { key: "stripe", label: "Stripe", url: "https://stripe.com", desc: "Full control, most flexible" },
  { key: "lemonsqueezy", label: "Lemon Squeezy", url: "https://lemonsqueezy.com", desc: "Merchant of record, handles VAT" },
  { key: "gumroad", label: "Gumroad", url: "https://gumroad.com", desc: "Simplest setup, high fees" },
] as const;

const PRICING_MODELS = [
  { key: "subscription", label: "Subscription", desc: "Recurring monthly / annual - highest LTV" },
  { key: "one_time", label: "One-time", desc: "Single purchase - easiest to sell" },
  { key: "usage", label: "Usage-based", desc: "Pay per use - aligns cost with value" },
  { key: "freemium", label: "Freemium", desc: "Free tier + paid upgrade - viral but harder to convert" },
] as const;

function MonetizeSubTab({ project, onUpdated }: { project: any; onUpdated: (patch: any) => void }) {
  const [processor, setProcessor] = useState<string>(project.paymentProcessor ?? "");
  const [pricingModel, setPricingModel] = useState<string>(project.pricingModel ?? "");
  const [price, setPrice] = useState<string>(
    project.pricePointCents ? String(project.pricePointCents / 100) : ""
  );
  const [trial, setTrial] = useState<string>(project.trialDays ? String(project.trialDays) : "");
  const [hasFree, setHasFree] = useState<boolean>(project.hasFree ?? false);
  const [checkoutUrl, setCheckoutUrl] = useState<string>(project.checkoutUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const pricePointCents = price ? Math.round(parseFloat(price) * 100) : null;
      const trialDays = trial ? parseInt(trial, 10) : null;
      await updateMonetizeConfig({
        data: {
          id: project.id,
          paymentProcessor: processor || undefined,
          pricingModel: pricingModel || undefined,
          pricePointCents,
          trialDays,
          hasFree,
          checkoutUrl: checkoutUrl.trim() || undefined,
        },
      });
      onUpdated({ paymentProcessor: processor, pricingModel, pricePointCents, trialDays, hasFree, checkoutUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const selectedProcessor = PROCESSORS.find((p) => p.key === processor);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius)",
    color: "var(--fg-muted)",
    fontSize: "0.82rem",
    padding: "8px 10px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelClass = "block text-[0.68rem] font-bold tracking-widest uppercase text-fg-subtle mb-[6px]";

  return (
    <div className="overflow-y-auto flex-1 px-6 py-5 pb-10">
      <div className="max-w-[560px]">

        {/* Payment processor */}
        <div className="mb-[22px]">
          <span className={labelClass}>Payment Processor</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {PROCESSORS.map((p) => {
              const active = processor === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setProcessor(active ? "" : p.key)}
                  className="p-[10px_12px] cursor-pointer text-left rounded-[var(--radius)]"
                  style={{
                    background: active ? "rgba(0,255,136,0.05)" : "var(--bg-elevated)",
                    border: `1px solid ${active ? "rgba(0,255,136,0.35)" : "var(--border-strong)"}`,
                  }}
                >
                  <div
                    className="text-sm font-semibold mb-[2px]"
                    style={{ color: active ? "var(--accent)" : "var(--fg)" }}
                  >
                    {p.label}
                  </div>
                  <div className="text-[0.70rem] text-fg-subtle leading-[1.4]">
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedProcessor && (
            <a
              href={selectedProcessor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[5px] mt-2 text-xs text-accent no-underline"
            >
              <ExternalLink size={11} /> Open {selectedProcessor.label} →
            </a>
          )}
        </div>

        {/* Pricing model */}
        <div className="mb-[22px]">
          <span className={labelClass}>Pricing Model</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {PRICING_MODELS.map((m) => {
              const active = pricingModel === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setPricingModel(active ? "" : m.key)}
                  className="p-[10px_12px] cursor-pointer text-left rounded-[var(--radius)]"
                  style={{
                    background: active ? "rgba(0,255,136,0.05)" : "var(--bg-elevated)",
                    border: `1px solid ${active ? "rgba(0,255,136,0.35)" : "var(--border-strong)"}`,
                  }}
                >
                  <div
                    className="text-sm font-semibold mb-[2px]"
                    style={{ color: active ? "var(--accent)" : "var(--fg)" }}
                  >
                    {m.label}
                  </div>
                  <div className="text-[0.70rem] text-fg-subtle leading-[1.4]">
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Price + trial row */}
        <div className="grid gap-3 mb-[22px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label className={labelClass}>
              Price (USD{pricingModel === "subscription" ? "/mo" : ""})
            </label>
            <div className="relative">
              <span
                className="absolute left-[10px] top-1/2 -translate-y-1/2 text-sm text-fg-subtle pointer-events-none"
              >
                $
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="49"
                min={0}
                step={1}
                style={{ ...fieldStyle, paddingLeft: 22 }}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Trial (days)</label>
            <input
              type="number"
              value={trial}
              onChange={(e) => setTrial(e.target.value)}
              placeholder="14"
              min={0}
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Free tier toggle */}
        <div className="flex items-center gap-[10px] mb-[22px]">
          <button
            onClick={() => setHasFree((v) => !v)}
            className="w-9 h-5 rounded-[10px] border-0 cursor-pointer relative flex-shrink-0"
            style={{
              background: hasFree ? "var(--accent)" : "var(--border-strong)",
              transition: "background 0.15s",
            }}
          >
            <span
              className="absolute top-[2px] w-4 h-4 rounded-full"
              style={{
                left: hasFree ? 18 : 2,
                background: hasFree ? "#0a0a0a" : "var(--fg-subtle)",
                transition: "left 0.15s",
              }}
            />
          </button>
          <span
            className="text-sm"
            style={{ color: hasFree ? "var(--fg)" : "var(--fg-subtle)" }}
          >
            Free tier
          </span>
          <span className="text-xs text-fg-subtle">
            {hasFree ? "Freemium - limits or feature gates on free plan" : "No free tier - trial or paid-only"}
          </span>
        </div>

        {/* Checkout URL */}
        <div className="mb-6">
          <label className={labelClass}>Checkout / Payment Link</label>
          <input
            type="url"
            value={checkoutUrl}
            onChange={(e) => setCheckoutUrl(e.target.value)}
            placeholder="https://buy.stripe.com/... or polar.sh/..."
            style={fieldStyle}
          />
          <p className="mt-[6px] mb-0 text-[0.70rem] text-fg-subtle leading-[1.5]">
            Direct link to your checkout page. Used to generate the CTA in distribution posts.
          </p>
        </div>

        {/* Summary row */}
        {(price || pricingModel) && (
          <div
            className="mb-5 px-[14px] py-3 text-sm text-fg-muted leading-[1.6] rounded-[var(--radius)]"
            style={{
              background: "rgba(0,255,136,0.04)",
              border: "1px solid rgba(0,255,136,0.12)",
            }}
          >
            {price && pricingModel === "subscription" && `$${price}/mo`}
            {price && pricingModel === "one_time" && `$${price} one-time`}
            {price && pricingModel === "usage" && `Usage-based, from $${price}`}
            {price && pricingModel === "freemium" && `Free + $${price}/mo`}
            {trial ? ` · ${trial}-day free trial` : ""}
            {hasFree && !pricingModel.includes("freemium") ? " · free tier" : ""}
            {processor ? ` · via ${PROCESSORS.find((p) => p.key === processor)?.label}` : ""}
          </div>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          style={{ gap: 6 }}
        >
          {saved ? <><Check size={13} /> Saved</> : saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── BuildPage ─────────────────────────────────────────────────────────────────

// ── Version header ────────────────────────────────────────────────────────────

type VersionEntry = { id: number; versionNumber: number; status: string; opportunityId: number | null; opportunityTitle: string | null; startedAt: Date; shippedAt: Date | null };

type DeployedFeature = { id: number; title: string; status: string; opportunityId: number | null; versionId: number | null; versionNumber: number | null };

// ── Compact deploy bar ────────────────────────────────────────────────────────

function DeployBar({ project, onUpdated, onVersionsChange, versions, stacks }: {
  project: any; onUpdated: (patch: any) => void;
  onVersionsChange: (v: VersionEntry[]) => void; versions: VersionEntry[];
  stacks: TechStack[];
}) {
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState("");
  const [configOpen, setConfigOpen] = useState(false);

  const deployStatus = project.deployStatus ?? "draft";
  const domain = project.domain ?? "";
  const webhookUrl = project.coolifyAppId ?? "";
  const STATUS_COLOR: Record<string, string> = { draft: "rgba(250,250,250,0.32)", deploying: "#f59e0b", deployed: "#22c55e", failed: "#ef4444" };
  const dotColor = STATUS_COLOR[deployStatus] ?? "rgba(250,250,250,0.32)";

  async function handleDeploy() {
    if (!webhookUrl.trim()) { setDeployLog("⚠ Configure a Coolify webhook first."); return; }
    setDeploying(true); setDeployLog("Deploying…");
    await updateDeployConfig({ data: { id: project.id, deployStatus: "deploying" } });
    onUpdated({ deployStatus: "deploying" });
    try {
      const res = await fetch("/api/coolify-deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: webhookUrl.trim() }) });
      if (res.ok) {
        setDeployLog("✓ Deployed");
        await updateDeployConfig({ data: { id: project.id, deployStatus: "deployed" } });
        onUpdated({ deployStatus: "deployed" });
        await markVersionShipped({ data: { productId: project.id } });
        onVersionsChange(versions.map(v => v.status === "building" ? { ...v, status: "shipped", shippedAt: new Date() } : v));
      } else {
        setDeployLog(`✗ Failed`);
        await updateDeployConfig({ data: { id: project.id, deployStatus: "failed" } });
        onUpdated({ deployStatus: "failed" });
      }
    } catch (err: any) {
      setDeployLog(`✗ ${err?.message}`);
      await updateDeployConfig({ data: { id: project.id, deployStatus: "failed" } });
      onUpdated({ deployStatus: "failed" });
    } finally { setDeploying(false); }
  }

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", padding: "8px 16px", background: "var(--bg)", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
        <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: dotColor }}>{deployStatus}</span>
      </span>
      {domain && deployStatus === "deployed" && (
        <a href={domain.startsWith("http") ? domain : `https://${domain}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.80rem", color: "var(--accent)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
          <ExternalLink size={11} />{domain}
        </a>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDeploy}
        disabled={deploying}
        style={{ border: `1px solid ${deploying ? "var(--border)" : "rgba(34,197,94,0.35)"}`, color: deploying ? "var(--fg-subtle)" : "#22c55e", fontSize: "0.76rem", padding: "3px 12px", height: "auto" }}
      >
        <Rocket size={11} />{deploying ? "Deploying…" : "Deploy"}
      </Button>
      {!webhookUrl && <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)} style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", height: "auto", padding: 0 }}>Configure webhook →</Button>}
      {deployLog && <span style={{ fontSize: "0.74rem", color: deployLog.startsWith("✓") ? "#22c55e" : deployLog.startsWith("✗") ? "#ef4444" : "rgba(250,250,250,0.45)" }}>{deployLog}</span>}
      <ProjectConfigModal open={configOpen} project={project} stacks={stacks} onClose={() => setConfigOpen(false)} onSaved={(patch) => onUpdated(patch)} />
    </div>
  );
}

// ── Version tree (right sidebar) ──────────────────────────────────────────────

function VersionTree({ versions, features, project, productId, allOpportunities, onVersionCreated, onVersionCancelled, onProjectRenamed, onReset }: {
  versions: VersionEntry[];
  features: Feature[];
  project: { id: number; name: string };
  productId: number;
  allOpportunities: OppForSelect[];
  onVersionCreated: (v: VersionEntry) => void;
  onVersionCancelled: (versionId: number) => void;
  onProjectRenamed: (name: string) => void;
  onReset: () => void;
}) {
  const confirm = useConfirm();
  const [width, setWidth] = useState(240);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleCancel(v: VersionEntry) {
    const ok = await confirm(
      `Cancel v${v.versionNumber}? This will delete the version record${v.opportunityTitle ? ` and reset "${v.opportunityTitle}" back to analyzed` : ""}.`,
      { variant: "danger", confirmLabel: "Cancel version" }
    );
    if (!ok) return;
    setCancelling(true);
    try {
      await cancelProjectVersion({ data: { versionId: v.id } });
      onVersionCancelled(v.id);
    } finally {
      setCancelling(false);
    }
  }

  async function handleReset() {
    const ok = await confirm(
      "Reset this project? All versions, features, and infrastructure settings will be cleared. You'll restart the initialization wizard from scratch.",
      { variant: "danger", confirmLabel: "Reset project" }
    );
    if (!ok) return;
    setResetting(true);
    try {
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
      await resetProject({ data: { productId, slug } });
      onReset();
    } finally {
      setResetting(false);
    }
  }

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setWidth(Math.max(180, Math.min(480, dragRef.current.startW + (ev.clientX - dragRef.current.startX))));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const isBuilding = versions.some(v => v.status === "building");
  const buildingVersion = versions.find(v => v.status === "building");
  const shipped = [...versions].filter(v => v.status === "shipped").sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div style={{ width, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Drag handle */}
      <div onMouseDown={onDragStart} style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 10 }} />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 40px" }}>
        <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 14 }}>Build History</div>

        {/* Currently building */}
        {buildingVersion && (
          <div style={{ marginBottom: 20, padding: "12px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: "0.60rem", fontWeight: 700, color: "var(--accent)", border: "1px solid var(--accent)", padding: "1px 6px", borderRadius: 3 }}>
                v{buildingVersion.versionNumber}
              </span>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: "0.64rem", color: "var(--accent)", flex: 1 }}>building</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancel(buildingVersion)}
                disabled={cancelling}
                title="Cancel this version"
                style={{ color: "rgba(250,250,250,0.25)", fontSize: "0.72rem", padding: "0 2px", height: "auto", lineHeight: 1, flexShrink: 0 }}
              >
                {cancelling ? "…" : "✕"}
              </Button>
            </div>
            {buildingVersion.opportunityTitle ? (
              <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.4, marginBottom: 8 }}>
                {buildingVersion.opportunityTitle}
              </div>
            ) : (
              <div style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.38)", lineHeight: 1.4, marginBottom: 8 }}>Iteration</div>
            )}
            {features.filter(f => f.opportunityId === buildingVersion.opportunityId).map(f => {
              const done = f.status === "built" || f.status === "launched";
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: "0.60rem", color: done ? "#22c55e" : "rgba(250,250,250,0.2)", flexShrink: 0, marginTop: 3 }}>{done ? "✓" : "·"}</span>
                  <span style={{ fontSize: "0.73rem", color: done ? "rgba(250,250,250,0.55)" : "rgba(250,250,250,0.38)", lineHeight: 1.45 }}>{f.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* New Version button - always visible, disabled while building */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (!isBuilding) setModalOpen(true); }}
          disabled={isBuilding}
          title={isBuilding ? "Deploy the current version before starting a new one" : undefined}
          style={{ width: "100%", marginBottom: 20, border: `1px dashed ${isBuilding ? "rgba(165,182,214,0.1)" : "rgba(165,182,214,0.2)"}`, color: isBuilding ? "rgba(250,250,250,0.2)" : "rgba(250,250,250,0.4)", fontSize: "0.78rem", padding: "10px 12px", height: "auto", justifyContent: "center" }}
        >
          <Plus size={12} /> New Version
        </Button>

        {/* Shipped history */}
        {shipped.length === 0 && !isBuilding && (
          <p style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.22)", lineHeight: 1.6 }}>Nothing shipped yet.</p>
        )}
        {shipped.map(v => {
          const vFeatures = features.filter(f => f.opportunityId === v.opportunityId);
          return (
            <div key={v.id} style={{ marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
              <div style={{ marginBottom: 5 }}>
                <span style={{ fontSize: "0.60rem", fontWeight: 700, color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", padding: "1px 6px", borderRadius: 3, opacity: 0.8 }}>
                  v{v.versionNumber}
                </span>
              </div>
              <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "rgba(250,250,250,0.65)", lineHeight: 1.4, marginBottom: vFeatures.length > 0 ? 8 : 0 }}>
                {v.opportunityTitle ?? "Iteration"}
              </div>
              {vFeatures.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {vFeatures.map(f => (
                    <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                      <span style={{ fontSize: "0.60rem", color: "rgba(34,197,94,0.5)", flexShrink: 0, marginTop: 3 }}>✓</span>
                      <span style={{ fontSize: "0.73rem", color: "rgba(250,250,250,0.38)", lineHeight: 1.45 }}>{f.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <NewVersionModal
          project={project}
          productId={productId}
          allOpportunities={allOpportunities}
          versions={versions}
          onClose={() => setModalOpen(false)}
          onCreated={(v) => { onVersionCreated(v); setModalOpen(false); }}
          onProjectRenamed={onProjectRenamed}
        />
      )}

      {/* Reset - only shown once project has been initialized (has versions) */}
      {versions.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px" }}>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            disabled={resetting || isBuilding}
            title={isBuilding ? "Stop the current build before resetting" : "Clear all versions and re-run the initialization wizard"}
            style={{ width: "100%", justifyContent: "center", fontSize: "0.72rem", padding: "7px 10px", height: "auto" }}
          >
            {resetting ? "Resetting…" : "↺ Reset & Re-initialize"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Design brief generator ────────────────────────────────────────────────────

function buildDesignBrief(opp: OppForSelect): string {
  const ins = opp.insightsJson;
  const features = ins?.v1_features?.slice(0, 6) ?? [];
  const competitors = ins?.competitors?.slice(0, 3) ?? [];

  return [
    `Design a production-ready web app UI for "${opp.title}"`,
    ``,
    `## The problem`,
    opp.painSummary,
    ins?.hidden_need ? `\nUnderlying need: ${ins.hidden_need}` : "",
    ``,
    `## Target user`,
    ins?.buyer_persona ?? "Solopreneurs and small teams",
    ``,
    features.length > 0 ? `## V1 features\n${features.map(f => `- ${f}`).join("\n")}` : "",
    ins?.price_anchor ? `\n## Price signal\n${ins.price_anchor}` : "",
    competitors.length > 0 ? `\n## Competitors & weaknesses\n${competitors.map(c => `- ${c}`).join("\n")}` : "",
    ``,
    `## Design direction`,
    `- Dark, minimal, high-contrast - no gradients, sharp edges`,
    `- Professional and focused, like Linear or Vercel dashboard`,
    `- Accent color: #00ff88 used sparingly for CTAs and highlights`,
    `- CSS variables: --bg #0a0a0a, --fg #fafafa, --border rgba(255,255,255,0.07)`,
    `- React + inline styles, no Tailwind`,
    ``,
    `Produce the main dashboard or primary workflow screen as a complete, working React component.`,
  ].filter(s => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── New Version Modal ─────────────────────────────────────────────────────────

function NewVersionModal({ project, productId, allOpportunities, versions, onClose, onCreated, onProjectRenamed }: {
  project: { id: number; name: string };
  productId: number;
  allOpportunities: OppForSelect[];
  versions: VersionEntry[];
  onClose: () => void;
  onCreated: (v: VersionEntry) => void;
  onProjectRenamed: (name: string) => void;
}) {
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null);
  const [renameProject, setRenameProject] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // First opportunity-linked version - suggest renaming
  const isFirstOppVersion = !versions.some(v => v.opportunityId !== null);

  const nextVersionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;
  const usedOppIds = new Set(versions.map(v => v.opportunityId).filter(Boolean));
  const availableOpps = allOpportunities.filter(o => !usedOppIds.has(o.id));
  const selectedOpp = allOpportunities.find(o => o.id === selectedOppId) ?? null;

  async function handleCreate() {
    setCreating(true); setError("");
    try {
      if (renameProject && selectedOpp) {
        await updateProject({ data: { id: project.id, name: selectedOpp.title, description: selectedOpp.painSummary } });
        onProjectRenamed(selectedOpp.title);
      }
      const { id, versionNumber } = await createProjectVersion({
        data: { productId, opportunityId: selectedOppId ?? undefined },
      });
      onCreated({
        id, versionNumber, status: "building",
        opportunityId: selectedOppId, opportunityTitle: selectedOpp?.title ?? null,
        startedAt: new Date(), shippedAt: null,
      });
    } catch (e: any) {
      setError(e.message ?? "Failed to create version.");
    } finally {
      setCreating(false);
    }
  }

  async function copyDesignBrief() {
    if (!selectedOpp) return;
    await navigator.clipboard.writeText(buildDesignBrief(selectedOpp));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", zIndex: 9001, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 540, background: "#0c0c0f", border: "1px solid rgba(165,182,214,0.12)", boxShadow: "0 32px 80px rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(165,182,214,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>New Version - v{nextVersionNumber}</h2>
            <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "rgba(165,182,214,0.45)" }}>
              Optionally link an opportunity, or skip to iterate on the current product.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ color: "rgba(165,182,214,0.4)", padding: 4, height: "auto" }}>✕</Button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Opportunity picker */}
          <div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.42)", marginBottom: 10 }}>
              Opportunity <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "rgba(165,182,214,0.3)" }}>- optional</span>
            </div>

            <div onClick={() => setSelectedOppId(null)}
              style={{ padding: "10px 12px", marginBottom: 6, border: `1px solid ${selectedOppId === null ? "rgba(165,182,214,0.4)" : "var(--border-strong)"}`, borderRadius: "var(--radius)", cursor: "pointer", background: selectedOppId === null ? "rgba(165,182,214,0.04)" : "transparent" }}
            >
              <div style={{ fontSize: "0.84rem", fontWeight: 600, color: selectedOppId === null ? "var(--fg)" : "var(--fg-muted)" }}>No opportunity - iterate</div>
              <div style={{ fontSize: "0.74rem", color: "rgba(165,182,214,0.4)", marginTop: 2 }}>Bug fixes, polish, small additions to the current product</div>
            </div>

            {availableOpps.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {availableOpps.map(o => {
                  const ins = o.insightsJson;
                  const selected = selectedOppId === o.id;
                  return (
                    <div key={o.id} onClick={() => setSelectedOppId(o.id)}
                      style={{ padding: "10px 12px", border: `1px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`, borderRadius: "var(--radius)", cursor: "pointer", background: selected ? "rgba(0,255,136,0.04)" : "transparent" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: "0.84rem", fontWeight: 600, color: selected ? "var(--fg)" : "var(--fg-muted)", flex: 1 }}>{o.title}</span>
                        <span style={{ fontSize: "0.70rem", fontWeight: 600, color: o.scoreTotal >= 7 ? "var(--accent)" : o.scoreTotal >= 5 ? "#f59e0b" : "#ef4444", flexShrink: 0 }}>{o.scoreTotal.toFixed(1)}</span>
                        {ins?.mrr_low && ins?.mrr_high && (
                          <span style={{ fontSize: "0.68rem", color: "rgba(250,250,250,0.4)", flexShrink: 0 }}>${(ins.mrr_low / 1000).toFixed(0)}k–${(ins.mrr_high / 1000).toFixed(0)}k</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "rgba(165,182,214,0.45)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.painSummary}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions panel - shown when an opportunity is selected */}
          {selectedOpp && (
            <div style={{ background: "rgba(165,182,214,0.03)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Design brief */}
              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.45)", marginBottom: 8 }}>Design</div>
                <p style={{ margin: "0 0 10px", fontSize: "0.76rem", color: "rgba(165,182,214,0.5)", lineHeight: 1.55 }}>
                  Copy the opportunity as a design brief, paste it into claude.ai/design to generate your UI, then save the output as your project's design direction.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyDesignBrief}
                    style={{ background: copied ? "rgba(0,255,136,0.08)" : "transparent", border: `1px solid ${copied ? "var(--accent)" : "var(--border-strong)"}`, color: copied ? "var(--accent)" : "var(--fg-muted)", fontSize: "0.78rem", padding: "6px 14px", height: "auto" }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy design brief"}
                  </Button>
                  <a href="https://claude.ai/design" target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.78rem", textDecoration: "none", fontFamily: "inherit" }}
                  >
                    <ExternalLink size={11} /> Open claude.ai/design
                  </a>
                </div>
              </div>

              {/* Rename project - only when first opportunity-linked version */}
              {isFirstOppVersion && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.45)", marginBottom: 8 }}>Project name</div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={renameProject} onChange={e => setRenameProject(e.target.checked)}
                      style={{ marginTop: 3, accentColor: "var(--accent)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.78rem", color: "rgba(165,182,214,0.7)", lineHeight: 1.5 }}>
                      Rename this project to <strong style={{ color: "var(--fg)" }}>"{selectedOpp.title}"</strong>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "rgba(165,182,214,0.4)", marginTop: 2 }}>Sets the project name and description from the opportunity</span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p style={{ margin: 0, fontSize: "0.78rem", color: "#ef4444" }}>{error}</p>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(165,182,214,0.08)", display: "flex", gap: 8 }}>
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating} style={{ gap: 6 }}>
            {creating ? "Creating…" : `Start v${nextVersionNumber}`}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </>
  );
}

// ── Mode selector (between versions) ─────────────────────────────────────────

function BuildModeSelector({ versions, onNewVersion, onIterate, onDeploy }: {
  versions: VersionEntry[]; onNewVersion: () => void; onIterate: () => void; onDeploy: () => void;
}) {
  const shipped = versions.filter(v => v.status === "shipped").sort((a, b) => b.versionNumber - a.versionNumber);
  const lastShipped = shipped[0];
  const nextVN = (versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) : 0) + 1;
  const isFoundationOnly = shipped.length > 0 && shipped.every(v => v.versionNumber === 0);

  if (isFoundationOnly) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div style={{ fontSize: "2.4rem", marginBottom: 16 }}>🏗️</div>
          <p style={{ margin: "0 0 8px", fontSize: "0.80rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>Foundation ready</p>
          <h3 style={{ margin: "0 0 10px", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Ready to build v1</h3>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", maxWidth: 360, lineHeight: 1.6 }}>
            Pick an opportunity and build your first version.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onNewVersion} style={{ fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
          Start Building v1 →
        </Button>
      </div>
    );
  }

  const card = (onClick: () => void, accent: string, bg: string, hoverBg: string, label: string, title: string, desc: string) => (
    <button onClick={onClick} style={{ padding: "22px 20px", background: bg, border: `1px solid ${accent}`, borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
    >
      <div style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "0.96rem", fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>{desc}</div>
    </button>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontSize: "0.80rem", color: "var(--fg-subtle)" }}>
          {lastShipped ? `v${lastShipped.versionNumber} built locally` : "Ready to start building"}
        </p>
        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, letterSpacing: "-0.01em" }}>What would you like to do?</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, width: "100%", maxWidth: 720 }}>
        {card(onNewVersion, "rgba(96,165,250,0.6)", "rgba(96,165,250,0.06)", "rgba(96,165,250,0.12)", "New Version", `Build v${nextVN}`, "Pick an opportunity and build the next major version")}
        {lastShipped && card(onIterate, "rgba(165,182,214,0.3)", "rgba(165,182,214,0.03)", "rgba(165,182,214,0.07)", "Iterate", `Improve v${lastShipped.versionNumber}`, "Add features, fix bugs, or refine existing functionality")}
        {card(onDeploy, "rgba(34,197,94,0.5)", "rgba(34,197,94,0.04)", "rgba(34,197,94,0.09)", "Ship it", lastShipped ? `Deploy v${lastShipped.versionNumber}` : "Deploy", "Push to production and make it live for real users")}
      </div>
    </div>
  );
}

// ── Iterate mode (simplified build) ──────────────────────────────────────────

function IterateBuildContent({ project, productId, features: initialFeatures, stacks }: {
  project: { id: number; name: string }; productId: number; features: Feature[]; stacks: TechStack[];
}) {
  const [featureList, setFeatureList] = useState<Feature[]>(initialFeatures.filter(f => f.status !== "built" && f.status !== "launched"));
  const [adding, setAdding] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeBuild, setActiveBuild] = useState<any>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [selectedStack, setSelectedStack] = useState(stacks.find(s => s.isDefault) ?? stacks[0] ?? null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isBuilding = activeBuild?.status === "running" || activeBuild?.status === "dev:starting";
  const isLive = activeBuild?.status === "dev:ready";

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [buildLogs.length]);

  useEffect(() => {
    if (!isBuilding) return;
    const es = new EventSource("/api/builds-stream");
    es.onmessage = (e) => {
      try {
        const { build } = JSON.parse(e.data);
        if (build && build.projectId === project.id) { setActiveBuild(build); setBuildLogs(build.logs || []); }
      } catch { }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [isBuilding, project.id]);

  async function startBuild() {
    const url = new URL("/api/build-opportunity", window.location.origin);
    url.searchParams.set("id", String(project.id));
    url.searchParams.set("title", `${project.name} iteration`);
    url.searchParams.set("projectId", String(project.id));
    if (selectedStack?.content) url.searchParams.set("techStack", selectedStack.content);
    if (customPrompt.trim()) url.searchParams.set("customPrompt", customPrompt.trim());
    fetch(url.toString()).catch(() => { });
    setActiveBuild({ status: "running", logs: [] });
    setBuildLogs([]);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px 60px" }}>
      <p style={{ margin: "0 0 24px", fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
        Improve the current version - add features, fix bugs, or refine existing functionality.
      </p>

      {/* Features */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.5)" }}>Features to build</span>
          {!adding && <Button variant="outline" size="sm" onClick={() => setAdding(true)} style={{ gap: 5, border: "1px solid var(--border-strong)", color: "var(--accent)", marginLeft: "auto" }}><Plus size={12} /> Add</Button>}
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {adding && <AddFeatureRow productId={productId} opportunityId={null} onAdded={(f) => { setFeatureList(prev => [f, ...prev]); setAdding(false); }} onCancel={() => setAdding(false)} />}
          {featureList.length === 0 && !adding ? (
            <div style={{ padding: "24px", textAlign: "center", fontSize: "0.82rem", color: "var(--fg-subtle)" }}>No features yet - add what you want to build or fix.</div>
          ) : featureList.map(f => (
            <FeatureRow key={f.id} feature={f} onUpdate={(patch) => setFeatureList(prev => prev.map(x => x.id === f.id ? { ...x, ...patch } : x))} onDelete={async () => { await deleteFeature({ data: { id: f.id } }); setFeatureList(prev => prev.filter(x => x.id !== f.id)); }} />
          ))}
        </div>
      </div>

      {/* Custom instructions */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.5)", marginBottom: 10 }}>Notes for Claude</div>
        <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Specific instructions, constraints, or context for this iteration…" rows={3} style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem", padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Build button */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <Button
          variant="primary"
          size="md"
          onClick={startBuild}
          disabled={isBuilding}
          style={isBuilding ? { background: "rgba(96,165,250,0.1)", color: "rgba(250,250,250,0.6)" } : undefined}
        >
          <Hammer size={14} />{isBuilding ? "Building…" : "Build Iteration"}
        </Button>
      </div>

      {buildLogs.length > 0 && (
        <div style={{ marginTop: 20, background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", borderLeft: `2px solid ${isLive ? "var(--accent)" : isBuilding ? "#f59e0b" : "var(--border)"}`, padding: "12px 14px", maxHeight: 360, overflowY: "auto", fontFamily: "inherit", fontSize: "0.80rem", lineHeight: 1.65 }}>
          {buildLogs.map((line, i) => {
            const color = line.startsWith("✓") ? "var(--accent)" : line.startsWith("✗") ? "#ef4444" : /http:\/\/localhost/.test(line) ? "var(--accent)" : "rgba(250,250,250,0.6)";
            return <div key={i} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</div>;
          })}
          {isLive && activeBuild?.devUrl && <a href={activeBuild.devUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}><ExternalLink size={12} /> Open App</a>}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

// ── Deployed Features (right sidebar) ────────────────────────────────────────

function DeployedFeaturesSidebar({ features: initialFeatures, versions }: {
  features: DeployedFeature[];
  versions: VersionEntry[];
}) {
  const [width, setWidth] = useState(220);
  const [features, setFeatures] = useState<DeployedFeature[]>(initialFeatures);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const buildingVersion = versions.find(v => v.status === "building") ?? null;

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setWidth(Math.max(160, Math.min(400, dragRef.current.startW - (ev.clientX - dragRef.current.startX))));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function handleRemove(featureId: number) {
    if (!buildingVersion) return;
    await markFeatureRemoved({ data: { featureId, versionId: buildingVersion.id } });
    setFeatures(prev => prev.filter(f => f.id !== featureId));
  }

  // Group by version they were introduced in
  const groups = new Map<number | null, DeployedFeature[]>();
  for (const f of features) {
    const key = f.versionId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return (b[0] ?? 0) - (a[0] ?? 0);
  });

  return (
    <div style={{ width, flexShrink: 0, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "relative" }}>
      <div onMouseDown={onDragStart} style={{ position: "absolute", left: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 10 }} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px 40px" }}>
        <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 6 }}>Live Features</div>
        {buildingVersion && (
          <div style={{ fontSize: "0.68rem", color: "rgba(250,250,250,0.3)", marginBottom: 14, lineHeight: 1.5 }}>
            Click × to remove from v{buildingVersion.versionNumber}
          </div>
        )}

        {features.length === 0 && (
          <p style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.22)", lineHeight: 1.6 }}>No deployed features yet.</p>
        )}

        {sortedGroups.map(([versionId, vFeatures]) => {
          const version = versions.find(v => v.id === versionId);
          const label = version ? `v${version.versionNumber}` : "Unversioned";
          return (
            <div key={versionId ?? "null"} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(250,250,250,0.28)", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {vFeatures.map(f => (
                  <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 5, padding: "5px 6px", borderRadius: 3, background: "transparent" }}
                  >
                    <span style={{ fontSize: "0.60rem", color: "#22c55e", flexShrink: 0, marginTop: 3 }}>✓</span>
                    <span style={{ fontSize: "0.74rem", color: "rgba(250,250,250,0.55)", lineHeight: 1.45, flex: 1 }}>{f.title}</span>
                    {buildingVersion && (
                      <button onClick={() => handleRemove(f.id)} title="Remove in this version"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(250,250,250,0.2)", fontSize: "0.72rem", padding: "0 2px", flexShrink: 0, lineHeight: 1, fontFamily: "inherit" }}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── V0 Initialization Flow ────────────────────────────────────────────────────

function V0InitFlow({ project, profile, onConfigure, onDone }: {
  project: { id: number; name: string; designDirection?: string | null };
  profile: { gitOrg?: string | null; gitToken?: string | null } | null;
  onConfigure: () => void;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const exitedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs.length]);

  const slug = (project.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
  const missingGit = !profile?.gitOrg || !profile?.gitToken;

  async function handleReset() {
    setResetting(true);
    setLogs(["Resetting v0 - deleting build dir and version record…"]);
    try {
      await resetV0Init({ data: { productId: project.id, slug } });
      setLogs(["✓ Reset complete - you can initialize again."]);
      setFailed(false);
    } catch (e: any) {
      setLogs(prev => [...prev, `✗ Reset failed: ${e.message}`]);
    } finally {
      setResetting(false);
    }
  }

  const STEPS = [
    { label: "Create GitHub repository", detect: (l: string) => l.includes("Creating GitHub") || l.includes("[4/") },
    { label: "Copy base template", detect: (l: string) => l.includes("[5/") || l.includes("Copying base") },
    { label: "Install dependencies", detect: (l: string) => l.includes("[9/") || l.includes("pnpm install") },
    { label: "Push to GitHub", detect: (l: string) => l.includes("[10/") || l.includes("Pushed to") },
  ];

  const completedSteps = new Set<number>();
  logs.forEach(l => {
    STEPS.forEach((s, i) => { if (s.detect(l)) completedSteps.add(i); });
    if (l.startsWith("✓ Project") || l.startsWith("✓ v0") || l.includes("initialised")) completedSteps.add(3);
  });
  const currentStep = done ? STEPS.length : running ? Math.max(...[...completedSteps, -1]) + 1 : -1;

  function startInit() {
    if (running) return;
    exitedRef.current = false;
    setRunning(true); setLogs(["$ init-project --project-id " + project.id, "Connecting…"]); setFailed(false); setDone(false);

    const es = new EventSource(`/api/init-project?projectId=${project.id}`);

    es.onmessage = (e) => {
      try {
        const line = JSON.parse(e.data) as string;
        if (line.startsWith("[BUILD_ID:") || line.startsWith("[BUILD_DIR:")) return;
        if (line.startsWith("[EXIT:")) {
          exitedRef.current = true;
          const code = parseInt(line.replace("[EXIT:", "").replace("]", ""), 10);
          es.close();
          setRunning(false);
          if (code === 0) { setDone(true); setTimeout(onDone, 1500); }
          else { setFailed(true); setLogs(prev => [...prev, "", `✗ Process exited with code ${code}`]); }
        } else {
          setLogs(prev => {
            const filtered = prev.filter(l => l !== "Connecting…");
            return [...filtered, line];
          });
        }
      } catch { }
    };

    es.onerror = (err) => {
      if (exitedRef.current) return; // normal close after [EXIT:]
      es.close();
      setRunning(false);
      setFailed(true);
      console.error("[V0InitFlow] SSE error:", err);
      setLogs(prev => [
        ...prev.filter(l => l !== "Connecting…"),
        "",
        "✗ Connection error - check the terminal below for details:",
        "  • Is the Vite dev server running?",
        "  • Check the server terminal for stack traces",
        `  • URL: /api/init-project?projectId=${project.id}`,
      ]);
    };
  }

  const accentColor = failed ? "#ef4444" : done ? "#22c55e" : "var(--accent)";
  const showTerminal = running || done || failed || logs.length > 0;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Left - info + controls */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto", padding: "32px 28px 60px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid var(--accent)", padding: "1px 7px", borderRadius: 3 }}>v0</span>
            <span style={{ fontSize: "0.96rem", fontWeight: 600, color: "var(--fg)" }}>Initialize Project</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--fg-subtle)", lineHeight: 1.65 }}>
            Creates a GitHub repo from the base template, installs deps, and pushes - giving you a working deployment pipeline before any features.
          </p>
        </div>

        {/* Prerequisites */}
        {missingGit && !running && (
          <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "var(--radius)", fontSize: "0.76rem", color: "#f59e0b", lineHeight: 1.6 }}>
            <strong>Git not configured.</strong>{" "}
            <a href="/settings/git" style={{ color: "#f59e0b" }}>Settings → Git →</a>
          </div>
        )}

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((step, i) => {
            const complete = completedSteps.has(i);
            const active = !complete && i === currentStep;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.60rem", fontWeight: 700,
                  background: complete ? "rgba(34,197,94,0.15)" : active ? "rgba(96,165,250,0.1)" : "transparent",
                  border: `1px solid ${complete ? "#22c55e" : active ? "rgba(96,165,250,0.5)" : "var(--border-strong)"}`,
                  color: complete ? "#22c55e" : active ? "var(--accent)" : "var(--fg-subtle)",
                }}>
                  {complete ? "✓" : i + 1}
                </span>
                <span style={{ fontSize: "0.80rem", color: complete ? "rgba(250,250,250,0.65)" : active ? "var(--fg)" : "rgba(250,250,250,0.35)" }}>
                  {step.label}
                </span>
                {active && running && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.5s infinite", flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {done && (
          <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "var(--radius)", fontSize: "0.80rem", color: "#22c55e", fontWeight: 600 }}>
            ✓ v0 initialized - refreshing…
          </div>
        )}

        {failed && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReset}
            disabled={resetting}
            style={{ alignSelf: "flex-start" }}
          >
            {resetting ? "Resetting…" : "Reset & start over"}
          </Button>
        )}

        {!done && (
          <Button
            variant="primary"
            size="md"
            onClick={startInit}
            disabled={running || missingGit}
            style={{ alignSelf: "flex-start" }}
          >
            {running
              ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(165,182,214,0.5)", animation: "pulse 1.5s infinite" }} /> Initializing…</>
              : failed ? "Retry" : "Initialize (v0)"}
          </Button>
        )}
      </div>

      {/* Right - terminal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#050508" }}>
        {/* Terminal title bar */}
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", padding: "7px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
          <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.35)" }}>
            {done ? "complete" : failed ? "failed" : running ? "running" : "terminal"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "rgba(250,250,250,0.25)" }}>
            init-project #{project.id}
          </span>
        </div>
        {/* Log content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 40px", fontFamily: "monospace", fontSize: "0.76rem", lineHeight: 1.7 }}>
          {!showTerminal && (
            <div style={{ color: "rgba(250,250,250,0.2)", paddingTop: 8 }}>
              $ init-project --project-id {project.id}<br />
              <span style={{ color: "rgba(250,250,250,0.12)" }}># Click "Initialize (v0)" to start</span>
            </div>
          )}
          {logs.map((line, i) => {
            const c = line.startsWith("✓") || line.startsWith("[REPO_URL") ? "#22c55e"
              : line.startsWith("✗") || line.startsWith("  → Failed") || line.includes("error") && !line.includes("No error") ? "#ef4444"
                : line.startsWith("═") || line.startsWith("INIT PROJECT") ? "#f59e0b"
                  : line.startsWith("  →") ? "rgba(250,250,250,0.5)"
                    : line.startsWith("[") && line.includes("/") ? "rgba(96,165,250,0.8)"
                      : "rgba(250,250,250,0.62)";
            return <div key={i} style={{ color: c, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</div>;
          })}
          {running && logs.length > 0 && (
            <span style={{ color: "var(--accent)", animation: "pulse 1s infinite" }}>▋</span>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

// ── Empty build state ─────────────────────────────────────────────────────────

function EmptyBuildState({ projectId }: { projectId: number }) {
  const navigate = useNavigate();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px", gap: 0 }}>
      <Hammer size={36} style={{ color: "var(--accent)", opacity: 0.4, marginBottom: 20 }} />
      <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Nothing to build yet</h3>
      <p style={{ margin: "0 0 28px", fontSize: "0.86rem", color: "var(--fg-subtle)", lineHeight: 1.6, textAlign: "center", maxWidth: 340 }}>
        Browse opportunities to find one worth building, then click "Build This" to start.
      </p>
      <Button
        variant="outline"
        size="md"
        onClick={() => navigate({ to: "/i/$id/opportunities", params: { id: String(projectId) }, search: { opp: undefined } })}
        style={{ border: "1px solid var(--accent)", color: "var(--accent)", background: "rgba(96,165,250,0.1)" }}
      >
        Browse Opportunities <ArrowRight size={14} />
      </Button>
    </div>
  );
}

// ── Deploy panel ──────────────────────────────────────────────────────────────

function DeployPanel({ project, productId, versions, onBack, onDeployed }: {
  project: any; productId: number; versions: VersionEntry[]; onBack: () => void; onDeployed: () => void;
}) {
  const lastShipped = versions.filter(v => v.status === "shipped").sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const [webhookUrl, setWebhookUrl] = useState(project.coolifyAppId ?? "");
  const [deploying, setDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const [error, setError] = useState("");

  async function handleDeploy() {
    if (!webhookUrl.trim()) { setError("Enter your Coolify webhook URL first."); return; }
    setDeploying(true); setError("");
    try {
      await updateDeployConfig({ data: { id: productId, coolifyAppId: webhookUrl.trim(), deployStatus: "deploying" } });
      const res = await fetch("/api/coolify-deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: webhookUrl.trim() }) });
      if (res.ok) {
        await updateDeployConfig({ data: { id: productId, deployStatus: "deployed" } });
        await markVersionShipped({ data: { productId } });
        setDeployDone(true);
        setTimeout(onDeployed, 1800);
      } else {
        const text = await res.text();
        setError(`Deploy failed: ${text}`);
        await updateDeployConfig({ data: { id: project.id, deployStatus: "failed" } });
      }
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally { setDeploying(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ color: "var(--fg-subtle)", fontSize: "0.78rem", padding: 0, marginBottom: 28, height: "auto" }}>
          <ArrowLeft size={13} /> Back
        </Button>
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(34,197,94,0.7)" }}>Ship it</p>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Deploy {lastShipped ? `v${lastShipped.versionNumber}` : ""} to production
          </h3>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
            {project.domain ? <>Your site will be live at <span style={{ color: "var(--accent)" }}>{project.domain}</span>.</> : "Trigger a Coolify deploy to push your build live."}
          </p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 6 }}>Coolify Webhook URL</label>
          <Input value={webhookUrl} onChange={e => { setWebhookUrl(e.target.value); setError(""); }} placeholder="https://coolify.example.com/api/v1/deploy/webhook?uuid=..." style={{ marginBottom: 6 }} />
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--fg-subtle)" }}>Coolify → Application → Webhooks → Deploy Webhook</p>
        </div>
        {error && <p style={{ margin: "0 0 14px", fontSize: "0.80rem", color: "#ef4444" }}>✗ {error}</p>}
        {deployDone ? (
          <div style={{ padding: "14px 18px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "var(--radius)", fontSize: "0.84rem", color: "#22c55e" }}>
            ✓ Deployed!{project.domain && <> <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Open {project.domain} →</a></>}
          </div>
        ) : (
          <Button variant="primary" size="md" onClick={handleDeploy} disabled={deploying || !webhookUrl.trim()} style={{ width: "100%", justifyContent: "center" }}>
            {deploying ? "Deploying…" : "Deploy now"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── BuildPage ─────────────────────────────────────────────────────────────────

function BuildPage() {
  const { project, setProject } = useProjectContext();
  const navigate = useNavigate();
  const router = useRouter();
  const { product, productId, features, opportunities, allOpportunities, stacks, designTemplates, designSystems, versions: initialVersions, deployedFeatures: initialDeployed, founderProfile } = Route.useLoaderData();
  const [versions, setVersions] = useState<VersionEntry[]>(initialVersions as VersionEntry[]);
  const [mode, setMode] = useState<"major" | "iterate" | "deploy" | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const buildingVersion = versions.find(v => v.status === "building") ?? null;
  const hasBuilding = buildingVersion !== null;
  const currentOpportunities = opportunities.filter(o => o.status === "building");
  const hasShipped = versions.some(v => v.status === "shipped");

  const showV0Init = versions.length === 0;
  // Building with a linked opportunity loaded → full build workflow
  const showBuildWorkflow = !showV0Init && hasBuilding && currentOpportunities.length > 0;
  // Building but no opportunity (iterate/no-opp version) → iterate UI
  const showIterateWorkflow = !showV0Init && hasBuilding && currentOpportunities.length === 0;
  const showModeSelector = !showV0Init && !hasBuilding && hasShipped && mode === null;
  const showIterateUI = !showV0Init && !hasBuilding && mode === "iterate";
  const showDeployUI = !showV0Init && !hasBuilding && mode === "deploy";
  const showEmptyState = !showV0Init && !hasBuilding && !hasShipped && mode === null;

  function handleVersionCreated(v: VersionEntry) {
    setVersions(prev => [...prev, v]);
    setMode(null);
    router.invalidate();
  }

  function handleVersionCancelled(versionId: number) {
    setVersions(prev => prev.filter(v => v.id !== versionId));
    router.invalidate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Left sidebar - build history (hidden during initialization wizard) */}
        {!showV0Init && <VersionTree
          versions={versions}
          features={features}
          project={project}
          productId={productId}
          allOpportunities={allOpportunities}
          onVersionCreated={handleVersionCreated}
          onVersionCancelled={handleVersionCancelled}
          onProjectRenamed={(name) => setProject(p => ({ ...p, name }))}
          onReset={() => { setVersions([]); router.invalidate(); }}
        />}

        {/* Center */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
          {showV0Init && (
            <InitWizard
              project={(product ?? project) as any}
              profile={founderProfile}
              allOpportunities={allOpportunities}
              founderProfile={founderProfile}
              designTemplates={designTemplates}
              designSystems={designSystems}
              stacks={stacks}
              onConfigure={() => setConfigOpen(true)}
              onDone={() => router.invalidate()}
            />
          )}
          {showBuildWorkflow && (
            <BuildSubTab project={project} productId={productId} opportunities={currentOpportunities} features={features} stacks={stacks} onConfigure={() => setConfigOpen(true)} />
          )}
          {showIterateWorkflow && (
            <IterateBuildContent project={project} productId={productId} features={features} stacks={stacks} />
          )}
          {showModeSelector && (
            <BuildModeSelector
              versions={versions}
              onNewVersion={() => navigate({ to: "/i/$id/opportunities", params: { id: String(project.id) }, search: { opp: undefined } })}
              onIterate={() => setMode("iterate")}
              onDeploy={() => setMode("deploy")}
            />
          )}
          {showIterateUI && (
            <IterateBuildContent project={project} productId={productId} features={features} stacks={stacks} />
          )}
          {showDeployUI && (
            <DeployPanel project={project} productId={productId} versions={versions} onBack={() => setMode(null)} onDeployed={() => { setMode(null); router.invalidate(); }} />
          )}
          {showEmptyState && (
            <EmptyBuildState projectId={project.id} />
          )}
        </div>
        {/* Right sidebar - live features (only when features exist) */}
        {initialDeployed.length > 0 && (
          <DeployedFeaturesSidebar
            features={initialDeployed as DeployedFeature[]}
            versions={versions}
          />
        )}
      </div>
      <ProjectConfigModal
        open={configOpen}
        project={project}
        stacks={stacks}
        onClose={() => setConfigOpen(false)}
        onSaved={(patch) => setProject(p => ({ ...p, ...patch }))}
      />
    </div>
  );
}
