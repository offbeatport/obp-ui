import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/Button";
import { DomainSuggestModal } from "~/components/ui/DomainSuggestModal";
import type { OppForSelect } from "~/lib/distribution-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardProject {
  id: number;
  name: string;
  designDirection?: string | null;
  domain?: string | null;
  vpsIp?: string | null;
  pricingModel?: string | null;
  pricePointCents?: number | null;
  techStackId?: number | null;
}

interface InitWizardProps {
  project: WizardProject;
  allOpportunities: OppForSelect[];
  profile?: any;
  founderProfile?: any;
  designTemplates?: any[];
  designSystems?: any[];
  stacks?: { id: number; name: string; content: string; isDefault: boolean }[];
  onConfigure?: () => void;
  onDone?: () => void;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Orange", value: "#f97316" },
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Sky", value: "#0ea5e9" },
];

const RADIUS_PRESETS = [
  { label: "Sharp", value: "0px" },
  { label: "Default", value: "6px" },
  { label: "Soft", value: "12px" },
  { label: "Rounded", value: "18px" },
  { label: "Full", value: "9999px" },
];


const APP_TYPES = [
  { key: "Tool", desc: "Single-purpose utility" },
  { key: "Dashboard", desc: "Data / admin interface" },
  { key: "Marketplace", desc: "Buyer + seller platform" },
  { key: "Directory", desc: "Curated listings" },
  { key: "SaaS", desc: "Multi-feature subscription" },
  { key: "Extension", desc: "Browser extension" },
  { key: "API", desc: "Developer / integration" },
  { key: "Community", desc: "Forum / social" },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const SUB_LABEL: React.CSSProperties = {
  fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "rgba(165,182,214,0.3)",
  display: "block", marginBottom: 7,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "rgba(165,182,214,0.35)",
  display: "block", marginBottom: 10,
};

const FIELD: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-elevated)",
  border: "1px solid rgba(165,182,214,0.14)",
  borderRadius: "var(--radius)",
  color: "var(--fg-muted)",
  fontSize: "0.83rem",
  padding: "8px 10px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.5,
};

const DIVIDER: React.CSSProperties = {
  borderTop: "1px solid rgba(165,182,214,0.07)",
  paddingTop: 20,
  marginBottom: 20,
};

// ── Prompt → HTML renderer ────────────────────────────────────────────────────

function promptToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const codeBlocks: string[] = [];
  let h = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="p-pre"><code class="p-code">${esc(code.trim())}</code></pre>`);
    return `\x00CB${idx}\x00`;
  });

  h = h.replace(/^# (.+)$/gm, '<h1 class="p-h1">$1</h1>');
  h = h.replace(/^## (.+)$/gm, '<h2 class="p-h2">$1</h2>');
  h = h.replace(/^### (.+)$/gm, '<h3 class="p-h3">$1</h3>');

  h = h.replace(/((?:^[ \t]*- .+\n?)+)/gm, block => {
    const items = block.trim().split("\n")
      .map(l => `<li>${esc(l.replace(/^[ \t]*- /, ""))}</li>`).join("");
    return `<ul class="p-ul">${items}</ul>`;
  });

  h = h.replace(/\*\*(.+?)\*\*/g, '<strong class="p-strong">$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code class="p-inline-code">$1</code>');

  h = h.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[1-3]|ul|pre|details)/.test(block) || block.startsWith("\x00CB")) return block;
    if (/<\/h[1-3]>$/.test(block)) return block;
    return `<p class="p-p">${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  codeBlocks.forEach((cb, i) => { h = h.replace(`\x00CB${i}\x00`, cb); });

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #010407; }
    .wrap {
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 12.5px;
      line-height: 1.75;
      color: rgba(165,182,214,0.7);
      padding: 28px 28px 60px;
      max-width: 100%;
    }
    .p-h1 {
      font-family: "Space Grotesk", sans-serif;
      font-size: 1.5rem;
      font-weight: 300;
      letter-spacing: -0.03em;
      color: #fff;
      margin: 0 0 24px;
      line-height: 1.15;
    }
    .p-h2 {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.60rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(96,165,250,0.7);
      margin: 32px 0 10px;
      padding-top: 24px;
      border-top: 1px solid rgba(100,130,180,0.1);
    }
    .p-h2:first-child { border-top: none; padding-top: 0; margin-top: 0; }
    .p-h3 {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.68rem;
      font-weight: 600;
      color: rgba(192,208,229,0.55);
      margin: 20px 0 8px;
      letter-spacing: 0.02em;
    }
    .p-p {
      color: rgba(192,208,229,0.72);
      margin-bottom: 10px;
      font-size: 12.5px;
      line-height: 1.75;
    }
    .p-ul {
      list-style: none;
      padding: 0;
      margin: 0 0 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .p-ul li {
      color: rgba(192,208,229,0.72);
      padding-left: 14px;
      position: relative;
    }
    .p-ul li::before {
      content: "-";
      position: absolute;
      left: 0;
      color: rgba(96,165,250,0.4);
    }
    .p-strong { color: rgba(239,245,255,0.95); font-weight: 600; }
    .p-inline-code {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.85em;
      color: rgba(167,139,250,0.85);
      background: rgba(167,139,250,0.08);
      border: 1px solid rgba(167,139,250,0.15);
      border-radius: 3px;
      padding: 1px 5px;
    }
    .p-pre {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(100,130,180,0.12);
      border-radius: 6px;
      padding: 14px 16px;
      margin: 8px 0 14px;
      overflow-x: auto;
    }
    .p-code {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.72rem;
      color: rgba(192,208,229,0.65);
      line-height: 1.65;
      white-space: pre;
    }
    details {
      margin: 6px 0 14px;
      border: 1px solid rgba(100,130,180,0.12);
      border-radius: 6px;
      overflow: hidden;
      background: rgba(6,13,28,0.6);
    }
    details summary {
      list-style: none;
      padding: 11px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.76rem;
      font-weight: 600;
      color: rgba(165,182,214,0.55);
      user-select: none;
      transition: background 0.1s, color 0.1s;
    }
    details summary:hover { background: rgba(165,182,214,0.04); color: rgba(165,182,214,0.8); }
    details summary::-webkit-details-marker { display: none; }
    details summary::before {
      content: "";
      width: 0; height: 0;
      border-style: solid;
      border-width: 4px 0 4px 6px;
      border-color: transparent transparent transparent rgba(165,182,214,0.3);
      transition: transform 0.15s ease;
      flex-shrink: 0;
    }
    details[open] summary::before { transform: rotate(90deg); }
    details[open] summary { color: rgba(165,182,214,0.75); border-bottom: 1px solid rgba(100,130,180,0.1); }
    details > *:not(summary) { padding: 14px 16px; font-size: 12px; }
  `;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><div class="wrap">${h}</div></body></html>`;
}

// ── InitWizard ────────────────────────────────────────────────────────────────

export function InitWizard({ project, allOpportunities, designSystems, stacks, onDone }: InitWizardProps) {
  const projectId = project.id;

  // Opportunity - the first "building" status opp linked to this project, or the first one available
  const buildingOpp = allOpportunities.find(o => o.status === "building") ?? allOpportunities[0] ?? null;
  const lockedOpp = buildingOpp;

  // Column widths
  const [leftW, setLeftW] = useState(360);
  const leftDrag = useRef<{ startX: number; startW: number } | null>(null);

  function onLeftResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    leftDrag.current = { startX: e.clientX, startW: leftW };
    function onMove(ev: MouseEvent) {
      if (!leftDrag.current) return;
      setLeftW(Math.max(240, Math.min(560, leftDrag.current.startW + ev.clientX - leftDrag.current.startX)));
    }
    function onUp() {
      leftDrag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }


  // Design - default design system to the marked-default (or first)
  const defaultDs = designSystems?.find((d: any) => d.isDefault) ?? designSystems?.[0] ?? null;

  const [accentColor, setAccentColor] = useState("#6366f1");
  const [radius, setRadius] = useState("6px");
  const [selectedDsId, setSelectedDsId] = useState<number | null>(defaultDs?.id ?? null);

  // App type
  const [appType, setAppType] = useState<string | null>("Tool");

  // Product
  const [domain, setDomain] = useState(project.domain ?? "");


  // Prompt (right column)
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [debouncedHtml, setDebouncedHtml] = useState("");

  // Domain suggest modal
  const [domainModalOpen, setDomainModalOpen] = useState(false);

  // Deploy status (replaces deploy checklist)
  const [checking, setChecking] = useState(false);
  const [deployStatus, setDeployStatus] = useState<{ ok: boolean; statusCode: number; latencyMs?: number; error?: string } | null>(null);

  // Design system preview
  const [dsPreview, setDsPreview] = useState<{ ds: any; x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = useCallback((ds: any, e: React.MouseEvent) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDsPreview({ ds, x: rect.right + 10, y: rect.top });
  }, []);

  const hidePreview = useCallback(() => {
    hideTimer.current = setTimeout(() => setDsPreview(null), 80);
  }, []);

  const keepPreview = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function openDsInNewTab(ds: any) {
    const blob = new Blob([ds.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function checkDeployStatus() {
    if (!domain.trim()) return;
    setChecking(true);
    setDeployStatus(null);
    try {
      const res = await fetch(`/api/health-check?domain=${encodeURIComponent(domain.trim())}`);
      setDeployStatus(await res.json());
    } catch {
      setDeployStatus({ ok: false, statusCode: 0, error: "network error" });
    } finally {
      setChecking(false);
    }
  }

  function buildDesignContext() {
    const parts: string[] = [];
    parts.push(`Accent color: ${accentColor}`);
    parts.push(`Border radius: ${radius}`);
    const ds = designSystems?.find((d: any) => d.id === selectedDsId);
    if (ds) parts.push(`Design system: ${ds.name}`);
    return parts.join(". ");
  }

  // Live prompt - fully client-side, no server call needed
  const livePrompt = useMemo(() => {
    const ins = lockedOpp?.insightsJson as any;
    const productName = lockedOpp?.title ?? project.name;
    const v1Features: string[] = ins?.v1_features ?? [];
    const mrrLow: number | null = ins?.mrr_low ?? null;
    const mrrHigh: number | null = ins?.mrr_high ?? null;
    const buyer: string = ins?.buyer_persona ?? "solopreneurs and small teams";
    const domainTarget = domain.trim() || "YOUR_DOMAIN";
    const ds = designSystems?.find((d: any) => d.id === selectedDsId);

    // Extract CSS from design system HTML
    const dsStyles = ds?.content
      ? (ds.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() ?? "")
      : "";

    const featureLines = v1Features.length
      ? v1Features.slice(0, 10).map((f: string) => `  - ${f}`).join("\n")
      : `  - Core feature\n  - User authentication\n  - Dashboard`;

    const paramsLines = [
      `App type:      ${appType ?? "Tool"}`,
      `Domain:        ${domainTarget}`,
      `Accent color:  ${accentColor}`,
      `Border radius: ${radius}`,
      ds ? `Design system: ${ds.name}` : null,
    ].filter(Boolean).join("\n");

    const mrrNote = mrrLow && mrrHigh
      ? `Revenue potential: $${(mrrLow / 1000).toFixed(0)}k–$${(mrrHigh / 1000).toFixed(0)}k/mo MRR`
      : "";

    const analysisLines = [
      lockedOpp?.painSummary ? `Pain: ${lockedOpp.painSummary}` : null,
      buyer ? `Target buyer: ${buyer}` : null,
      mrrNote || null,
      ins?.price_anchor ? `Price anchor: ${ins.price_anchor}` : null,
      ins?.hidden_need ? `Hidden need: ${ins.hidden_need}` : null,
      ins?.self_growth ? `Self-growth: ${ins.self_growth}` : null,
    ].filter(Boolean).join("\n");

    const briefSection = lockedOpp?.briefMd?.trim()
      ? `<details>\n<summary>📋 Opportunity Brief (full research)</summary>\n\n${lockedOpp.briefMd.trim()}\n\n</details>`
      : "";

    const dsSection = dsStyles
      ? `<details>\n<summary>🎨 Design System CSS (${ds!.name})</summary>\n\nUse these classes and tokens exactly - do not rename them.\n\n\`\`\`css\n${dsStyles}\n\`\`\`\n\n</details>`
      : "";

    return `# BUILD: ${productName}

## PROBLEM

${lockedOpp?.painSummary ?? "(link an opportunity to populate this)"}

${briefSection}

## OPPORTUNITY ANALYSIS

${analysisLines || "(no analysis)"}

## BUILD PARAMETERS

${paramsLines}

## PRICING

${(() => {
        const model = project.pricingModel ?? ins?.pricing_model ?? null;
        const cents = project.pricePointCents ?? null;
        const anchor = ins?.price_anchor ?? null;
        if (cents && model === "subscription") return `$${(cents / 100).toFixed(0)}/month subscription`;
        if (cents && model === "one_time") return `$${(cents / 100).toFixed(0)} one-time purchase`;
        if (cents && model === "freemium") return `Freemium - free tier + $${(cents / 100).toFixed(0)}/month paid`;
        if (cents && model === "usage") return `Usage-based from $${(cents / 100).toFixed(0)}`;
        if (anchor) return `Market signals suggest: ${anchor}`;
        if (model) return model;
        return "To be defined - check Distribution Strategy playbook";
      })()}

## V1 FEATURES

${featureLines}

## KEY ROUTES

  /  (landing page)
  /auth/login
  /auth/signup
  /dashboard  (main app view)
  /settings
  /pricing
  /admin  (ADMIN_EMAILS only)

## HAPPY PATH

User lands on / → signs up at /auth/signup → completes the core action in /dashboard → sees the value → upgrades at /pricing

## TECH STACK

${(() => {
        const selectedStack = stacks?.find(s => s.id === project.techStackId)
          ?? stacks?.find(s => s.isDefault)
          ?? null;
        return selectedStack
          ? selectedStack.content
          : `- TanStack Start, React.js, SQLite, Drizzle ORM, TailwindCSS, shadcn/ui, base-ui-components\n- Polar.sh (payments), Sentry (errors), PostHog (analytics), better-auth (auth)\n- lucide-react, recharts, remark, rehype, @tanstack/react-table, Vite, Vitest, pnpm, OpenRouter`;
      })()}
- Single repo - no monorepo. Zero setup beyond: pnpm install && pnpm dev
- Deployable via Coolify (Dockerfile required). .env and .env.example with all values.

## DESIGN RULES

- global.css defines all CSS variables: primary, secondary, accent (${accentColor}), error, bg, border, etc.
- Border radius: ${radius} - apply consistently via CSS variable
- Typography: "Space Grotesk", Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
- Large, light Space Grotesk for titles. Flat design - no background panels. Design relies on typography.
- Simple, premium, professional - not overwhelming

${dsSection}

## AUTH

- Google OAuth + email/password registration via better-auth
- /admin only accessible to emails listed in ADMIN_EMAILS env var

## BUILD ORDER

### Step 1 - Frontend first (deliver this before any backend)

Build all routes listed above with hardcoded mock data.
No database, no auth, no real API calls yet.
Every page must be navigable and the full happy path demonstrable with mocks.

Deliver: \`pnpm dev\` → click through the entire happy path with mock data.
Output: list of pages built and what remains mocked.

### Step 2 - Backend + full functionality

- SQLite schema with Drizzle ORM inline migrations
- Authentication: Google OAuth + email/password (better-auth)
- Replace all mocks with real server functions (createServerFn pattern)
- Polar.sh payment integration
- /admin gated by ADMIN_EMAILS env var
- Sentry + PostHog. Dockerfile. Complete .env and .env.example.

## INSTRUCTIONS

1. Follow TanStack Start server function conventions (createServerFn) exactly
2. Keep it simple - shipping working code beats perfect code
3. The goal is something real users will pay for within a week`.trim()
      .replace(/\n{3,}/g, "\n\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedOpp?.id, lockedOpp?.briefMd, accentColor, radius, selectedDsId, domain, appType, project.name, project.techStackId, project.pricingModel, project.pricePointCents, designSystems, stacks]);

  // Prompt starts as the live-computed version, stays editable after that
  const [prompt, setPrompt] = useState<string>(livePrompt);

  // Keep prompt in sync with config changes
  useEffect(() => {
    setPrompt(livePrompt);
  }, [livePrompt]);

  // Debounce iframe re-render by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(promptToHtml(prompt)), 300);
    return () => clearTimeout(t);
  }, [prompt]);

  async function handleCopy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }



  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── LEFT: Config ─────────────────────────────────────────────── */}
      <div style={{
        width: leftW, flexShrink: 0,
        position: "relative",
        overflowY: "auto",
        padding: "22px 18px 40px",
        display: "flex", flexDirection: "column",
      }}>

        {/* Opportunity - read-only */}
        <div style={{ marginBottom: 20 }}>
          <span style={SECTION_LABEL}>Opportunity</span>
          {lockedOpp ? (() => {
            const ins = lockedOpp.insightsJson as any;
            const mrrLow = ins?.mrr_low ? `$${Math.round(ins.mrr_low / 1000)}k` : null;
            const mrrHigh = ins?.mrr_high ? `$${Math.round(ins.mrr_high / 1000)}k` : null;
            const mrrRange = mrrLow && mrrHigh ? `${mrrLow}–${mrrHigh}/mo` : null;
            const wtpCount = (ins?.wtp_evidence ?? []).length;
            const buyer = ins?.buyer_persona ?? null;
            const price = ins?.price_anchor ?? null;
            const scoreColor = lockedOpp.scoreTotal >= 7 ? "#6366f1" : lockedOpp.scoreTotal >= 5 ? "#f59e0b" : "#ef4444";
            return (
              <div style={{
                padding: "12px 14px",
                background: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.18)",
                borderRadius: "var(--radius)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {/* Title + change link */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.35, marginBottom: 4 }}>
                      {lockedOpp.title}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "rgba(165,182,214,0.55)", lineHeight: 1.5 }}>
                      {lockedOpp.painSummary.length > 100
                        ? lockedOpp.painSummary.slice(0, 98) + "…"
                        : lockedOpp.painSummary}
                    </div>
                  </div>
                  <Link
                    to="/i/$id/opportunities"
                    params={{ id: String(projectId) }}
                    search={{ opp: undefined }}
                    style={{ fontSize: "0.64rem", color: "rgba(165,182,214,0.25)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginTop: 1 }}
                  >
                    <LinkIcon size={8} />
                  </Link>
                </div>

                {/* Key numbers */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: scoreColor, background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`, borderRadius: 4, padding: "2px 7px" }}>
                    Score {lockedOpp.scoreTotal.toFixed(1)}
                  </span>
                  {mrrRange && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#10b981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 4, padding: "2px 7px" }}>
                      {mrrRange}
                    </span>
                  )}
                  {wtpCount > 0 && (
                    <span style={{ fontSize: "0.68rem", color: "rgba(165,182,214,0.45)", background: "rgba(165,182,214,0.06)", border: "1px solid rgba(165,182,214,0.12)", borderRadius: 4, padding: "2px 7px" }}>
                      {wtpCount} WTP signals
                    </span>
                  )}
                  {price && (
                    <span style={{ fontSize: "0.68rem", color: "rgba(165,182,214,0.45)", background: "rgba(165,182,214,0.06)", border: "1px solid rgba(165,182,214,0.12)", borderRadius: 4, padding: "2px 7px" }}>
                      {price}
                    </span>
                  )}
                </div>

                {/* Buyer persona */}
                {buyer && (
                  <div style={{ fontSize: "0.72rem", color: "rgba(165,182,214,0.4)", lineHeight: 1.45, borderTop: "1px solid rgba(165,182,214,0.08)", paddingTop: 7 }}>
                    <span style={{ color: "rgba(165,182,214,0.25)", marginRight: 4 }}>Buyer</span>
                    {buyer.length > 80 ? buyer.slice(0, 78) + "…" : buyer}
                  </div>
                )}
              </div>
            );
          })() : (
            <p style={{ margin: 0, fontSize: "0.80rem", color: "rgba(165,182,214,0.3)" }}>
              No opportunity linked - go to the{" "}
              <Link to="/i/$id/opportunities" params={{ id: String(projectId) }} search={{ opp: undefined }} style={{ color: "rgba(165,182,214,0.5)" }}>
                Opportunities tab
              </Link>{" "}
              and click Build.
            </p>
          )}
        </div>

        {/* App type */}
        <div style={DIVIDER} />
        <div style={{ marginBottom: 20 }}>
          <span style={SECTION_LABEL}>App Type</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {APP_TYPES.map(t => {
              const active = appType === t.key;
              return (
                <button key={t.key} onClick={() => setAppType(active ? null : t.key)} style={{
                  padding: "7px 9px", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit",
                  background: active ? "rgba(99,102,241,0.08)" : "transparent",
                  border: `1px solid ${active ? "rgba(99,102,241,0.35)" : "rgba(165,182,214,0.1)"}`,
                  borderRadius: "var(--radius)",
                }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: active ? 600 : 400, color: active ? "#6366f1" : "var(--fg-subtle)" }}>{t.key}</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.3)", marginTop: 1 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain */}
        <div style={DIVIDER} />
        <div style={{ marginBottom: 20 }}>
          <span style={SECTION_LABEL}>Domain</span>
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="example.com"
            style={FIELD}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDomainModalOpen(true)}
            style={{ marginTop: 6, border: "1px solid rgba(165,182,214,0.12)", color: "rgba(165,182,214,0.4)", fontSize: "0.72rem", height: "auto", padding: "4px 10px" }}
          >
            ✦ Suggest domains
          </Button>
          <DomainSuggestModal
            open={domainModalOpen}
            topic={lockedOpp?.title ?? project.name}
            onClose={() => setDomainModalOpen(false)}
            onSelect={(d) => { setDomain(d); setDomainModalOpen(false); }}
          />
        </div>

        {/* Design */}
        <div style={DIVIDER} />
        <div style={{ marginBottom: 20 }}>
          <span style={SECTION_LABEL}>Design</span>

          <div style={{ marginBottom: 14 }}>
            <span style={SUB_LABEL}>Accent</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ACCENT_PRESETS.map(p => (
                <button key={p.value} onClick={() => setAccentColor(p.value)} title={p.label}
                  className="color-swatch"
                  style={{
                    width: 22, height: 22, borderRadius: "50%", background: p.value,
                    border: accentColor === p.value ? "2px solid #fff" : "2px solid transparent",
                    boxShadow: accentColor === p.value ? `0 0 0 2px ${p.value}` : "none",
                    cursor: "pointer", outline: "none", transition: "transform 0.1s",
                  }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={SUB_LABEL}>Radius</span>
            <div style={{ display: "flex", gap: 5 }}>
              {RADIUS_PRESETS.map(p => {
                const active = radius === p.value;
                return (
                  <button key={p.value} onClick={() => setRadius(p.value)} style={{
                    padding: "4px 10px", fontSize: "0.72rem", fontFamily: "inherit",
                    fontWeight: active ? 600 : 400, cursor: "pointer",
                    background: active ? "rgba(165,182,214,0.1)" : "transparent",
                    border: `1px solid ${active ? "rgba(165,182,214,0.3)" : "rgba(165,182,214,0.1)"}`,
                    borderRadius: p.value, color: active ? "var(--fg)" : "var(--fg-subtle)",
                  }}>{p.label}</button>
                );
              })}
            </div>
          </div>

          {designSystems && designSystems.length > 0 && (
            <div>
              <span style={SUB_LABEL}>Design System</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {designSystems.map((ds: any) => {
                  const sel = selectedDsId === ds.id;
                  return (
                    <div key={ds.id}
                      onClick={() => setSelectedDsId(sel ? null : ds.id)}
                      onMouseEnter={(e) => showPreview(ds, e)}
                      onMouseLeave={hidePreview}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                        background: sel ? "rgba(165,182,214,0.06)" : "transparent",
                        border: `1px solid ${sel ? "rgba(165,182,214,0.22)" : "rgba(165,182,214,0.09)"}`,
                        borderRadius: "var(--radius)", cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                        border: `1px solid ${sel ? "var(--accent)" : "rgba(165,182,214,0.22)"}`,
                        background: sel ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && <Check size={8} color="#050d1e" />}
                      </div>
                      <span style={{ fontSize: "0.80rem", color: sel ? "var(--fg)" : "var(--fg-muted)", flex: 1 }}>{ds.name}</span>
                      <ExternalLink size={10} style={{ color: "rgba(165,182,214,0.2)", flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Check Deploy Status - bottom of left panel */}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(165,182,214,0.07)" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={checkDeployStatus}
            disabled={checking || !domain.trim()}
            style={{ width: "100%", justifyContent: "center", opacity: !domain.trim() ? 0.4 : 1 }}
          >
            {checking ? "Checking…" : "Check Deploy Status"}
          </Button>
          {deployStatus && (
            <div style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 7,
              padding: "8px 10px",
              background: deployStatus.ok ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
              border: `1px solid ${deployStatus.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              borderRadius: "var(--radius)",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: deployStatus.ok ? "var(--success)" : "var(--danger)",
              }} />
              <span style={{ fontSize: "0.74rem", color: deployStatus.ok ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                {deployStatus.ok
                  ? `Live · ${deployStatus.statusCode} · ${deployStatus.latencyMs}ms`
                  : `Down · ${deployStatus.error ?? deployStatus.statusCode}`}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Resize handle - left */}
      <div
        onMouseDown={onLeftResizeStart}
        style={{
          width: 4, flexShrink: 0, cursor: "col-resize",
          background: "var(--border)",
          transition: "background 0.15s",
        }}
        className="resize-handle"
      />

      {/* ── RIGHT: Prompt + Deploy ───────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {(
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Prompt header */}
            <div style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg)",
            }}>
              <span style={{ ...SECTION_LABEL, marginBottom: 0, flex: 1 }}>Master Build Prompt</span>

              {/* Preview / Edit toggle */}
              <div style={{ display: "flex", background: "rgba(165,182,214,0.05)", border: "1px solid rgba(165,182,214,0.1)", borderRadius: "var(--radius)", padding: 2, gap: 2 }}>
                {(["preview", "edit"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "3px 10px", fontSize: "0.68rem", fontWeight: 600,
                      fontFamily: "inherit", cursor: "pointer",
                      border: "none", borderRadius: 4,
                      background: viewMode === mode ? "rgba(165,182,214,0.12)" : "transparent",
                      color: viewMode === mode ? "var(--fg-muted)" : "rgba(165,182,214,0.3)",
                      textTransform: "capitalize", letterSpacing: "0.02em",
                      transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <Button variant="primary" size="sm" onClick={handleCopy}>
                <Copy size={11} /> {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Preview or Edit */}
            {viewMode === "preview" ? (
              <iframe
                srcDoc={debouncedHtml || promptToHtml(prompt)}
                style={{ flex: 1, border: "none", background: "#010407" }}
                sandbox="allow-same-origin"
              />
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  style={{
                    flex: 1, width: "100%", background: "var(--bg)", border: "none", outline: "none",
                    color: "rgba(192,208,229,0.85)", fontFamily: "var(--font-mono)",
                    fontSize: "0.78rem", lineHeight: 1.72, padding: "20px 22px 48px",
                    resize: "none", boxSizing: "border-box",
                  }}
                />
                {prompt !== livePrompt && (
                  <button
                    onClick={() => setPrompt(livePrompt)}
                    style={{
                      position: "absolute", bottom: 14, right: 14,
                      background: "rgba(6,13,28,0.95)", border: "1px solid rgba(165,182,214,0.15)",
                      borderRadius: "var(--radius)", cursor: "pointer", padding: "4px 10px",
                      fontSize: "0.68rem", color: "rgba(165,182,214,0.4)", fontFamily: "inherit",
                    }}
                  >
                    Reset to generated
                  </button>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Design system preview portal ─────────────────────────────── */}
      {dsPreview && createPortal(
        <div
          onMouseEnter={keepPreview}
          onMouseLeave={hidePreview}
          style={{
            position: "fixed",
            left: Math.min(dsPreview.x, window.innerWidth - 428),
            top: Math.max(8, Math.min(dsPreview.y, window.innerHeight - 508)),
            zIndex: 9999, width: 420,
            background: "#0c0c10", border: "1px solid rgba(165,182,214,0.14)",
            borderRadius: 8, boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            borderBottom: "1px solid rgba(165,182,214,0.09)", background: "rgba(0,0,0,0.3)", flexShrink: 0,
          }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(165,182,214,0.55)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {dsPreview.ds.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDsInNewTab(dsPreview.ds)}
              style={{ border: "1px solid rgba(165,182,214,0.14)", color: "rgba(165,182,214,0.5)", fontSize: "0.68rem", height: "auto", padding: "3px 8px" }}
            >
              <ExternalLink size={10} /> Open full screen
            </Button>
          </div>
          <div style={{ width: 420, height: 480, overflow: "hidden" }}>
            <iframe
              srcDoc={dsPreview.ds.content}
              title={dsPreview.ds.name}
              sandbox="allow-same-origin"
              style={{ width: 840, height: 960, border: "none", transform: "scale(0.5)", transformOrigin: "top left", pointerEvents: "none" }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
