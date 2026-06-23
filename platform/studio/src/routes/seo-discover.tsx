import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { discoverSeoKeywords, buildFullProjectFromOp } from "~/lib/project-fns";
import type { SeoKeyword } from "~/lib/project-fns";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2, Download, Copy, Check, TrendingUp, Hammer, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Dropdown } from "~/components/ui/Dropdown";
import { Tooltip } from "~/components/ui/Tooltip";

export const Route = createFileRoute("/seo-discover")({
  component: SeoDiscoverPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const INTENT_CFG = {
  transactional: { label: "Buy", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" },
  commercial: { label: "Compare", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)" },
  informational: { label: "Learn", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  navigational: { label: "Nav", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
};

const COMP_CFG: Record<string, { color: string }> = {
  LOW: { color: "#22c55e" },
  MEDIUM: { color: "#f59e0b" },
  HIGH: { color: "#ef4444" },
  UNKNOWN: { color: "#94a3b8" },
};

type IntentFilter = "all" | SeoKeyword["intent"];
type SortKey = "opportunity" | "volume" | "cpc" | "competition";

const EXAMPLE_SEEDS = [
  "quickbooks invoice export",
  "shift scheduling small restaurant",
  "spreadsheet to web app",
  "freelance lead research tool",
  "export documentation software",
].join("\n");

function exportCsv(rows: SeoKeyword[]) {
  const headers = ["Keyword", "Volume", "CPC", "Competition", "Opportunity Score", "Intent", "AI Prompt"];
  const lines = rows.map(r => [
    `"${r.keyword.replace(/"/g, '""')}"`, r.volume, r.cpc.toFixed(2),
    r.competitionLevel, r.opportunityScore, r.intent, r.isAiPrompt ? "yes" : "",
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seo-discover-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SeoDiscoverPage() {
  const navigate = useNavigate();

  const [seeds, setSeeds] = useState("");
  const [maxVolume, setMaxVolume] = useState(5000);
  const [minCpc, setMinCpc] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ keywords: SeoKeyword[]; cost: number; error?: string } | null>(null);

  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [aiOnly, setAiOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("opportunity");
  const [keyword, setKeyword] = useState("");
  const [copied, setCopied] = useState(false);
  const [buildingKw, setBuildingKw] = useState<string | null>(null);

  async function handleRun() {
    const seedList = seeds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!seedList.length) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await discoverSeoKeywords({ data: { seeds: seedList, maxVolume, minCpc } });
      setResult(res);
    } catch (e) {
      setResult({ keywords: [], cost: 0, error: String(e) });
    }
    setLoading(false);
  }

  async function handleBuild(kw: SeoKeyword) {
    setBuildingKw(kw.keyword);
    try {
      const desc = [
        `## SEO Opportunity: ${kw.keyword}`,
        `**Search volume:** ${kw.volume.toLocaleString()}/mo`,
        `**CPC:** $${kw.cpc.toFixed(2)} - advertisers pay this much to reach these searchers`,
        `**Competition:** ${kw.competitionLevel}`,
        `**Search intent:** ${kw.intent} - ${kw.intent === "transactional" ? "buyer is ready to spend" : kw.intent === "commercial" ? "buyer is comparing options" : "buyer is researching"}`,
        kw.isAiPrompt ? "**AI search pattern:** yes - people also ask AI assistants this" : "",
        `**Opportunity signal:** People searching "${kw.keyword}" are looking for a solution. Build a tool that ranks for this keyword and solves it.`,
      ].filter(Boolean).join("\n");

      const { projectId, opportunityId } = await buildFullProjectFromOp({
        data: { title: kw.keyword, description: desc, communities: [], hypothesis: desc.slice(0, 200) },
      });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/i/$id/opportunities", params: { id: String(projectId) }, search: { opp: opportunityId } });
    } catch { }
    setBuildingKw(null);
  }

  const filtered = useMemo(() => {
    if (!result) return [];
    let list = [...result.keywords];
    if (intentFilter !== "all") list = list.filter(k => k.intent === intentFilter);
    if (aiOnly) list = list.filter(k => k.isAiPrompt);
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      list = list.filter(k => k.keyword.toLowerCase().includes(kw));
    }
    list.sort((a, b) => {
      if (sortKey === "volume") return b.volume - a.volume;
      if (sortKey === "cpc") return b.cpc - a.cpc;
      if (sortKey === "competition") return a.competition - b.competition;
      return b.opportunityScore - a.opportunityScore;
    });
    return list;
  }, [result, intentFilter, aiOnly, sortKey, keyword]);

  const intentCounts = useMemo(() => {
    if (!result) return {} as Record<string, number>;
    const c: Record<string, number> = {};
    for (const k of result.keywords) c[k.intent] = (c[k.intent] ?? 0) + 1;
    return c;
  }, [result]);

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "opportunity", label: "Opportunity score" },
    { value: "volume", label: "Search volume" },
    { value: "cpc", label: "CPC (highest)" },
    { value: "competition", label: "Competition (lowest)" },
  ];

  return (
    <div style={{ padding: "24px", minHeight: "100%", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .pill{cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:3px 9px;font-size:0.71rem;font-weight:500;background:transparent;color:var(--fg-subtle);font-family:inherit;transition:all 0.1s}
        .pill:hover{border-color:rgba(165,182,214,0.3);color:var(--fg-muted)}
        .pill.on{background:rgba(96,165,250,0.09);border-color:rgba(96,165,250,0.28);color:var(--accent)}
        .kw-input{background:rgba(165,182,214,0.04);border:1px solid var(--border);border-radius:5px;color:var(--fg);font-size:0.78rem;padding:3px 10px;font-family:inherit;outline:none;width:160px}
        .kw-input:focus{border-color:rgba(165,182,214,0.3)}
        .kw-row:hover{background:rgba(165,182,214,0.025) !important}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>SEO Discovery</h1>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--fg-subtle)" }}>
          Find keywords people are actively searching for. High CPC + transactional intent = willingness to pay.
        </p>
      </div>

      {/* Input panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Seed keywords <span style={{ fontWeight: 400, textTransform: "none" }}>(one per line, max 5)</span>
          </label>
          <textarea
            value={seeds}
            onChange={e => setSeeds(e.target.value)}
            placeholder={EXAMPLE_SEEDS}
            rows={5}
            style={{ background: "rgba(165,182,214,0.04)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg)", fontSize: "0.80rem", lineHeight: 1.6, padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", width: "100%", boxSizing: "border-box" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(165,182,214,0.3)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
              Max volume / mo
            </label>
            <Dropdown
              value={String(maxVolume)}
              options={[
                { value: "1000", label: "≤ 1,000" },
                { value: "5000", label: "≤ 5,000" },
                { value: "10000", label: "≤ 10,000" },
                { value: "50000", label: "≤ 50,000" },
                { value: "999999", label: "All" },
              ]}
              onChange={v => setMaxVolume(Number(v))}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
              Min CPC ($)
            </label>
            <Dropdown
              value={String(minCpc)}
              options={[
                { value: "0", label: "Any" },
                { value: "0.5", label: "≥ $0.50" },
                { value: "1", label: "≥ $1.00" },
                { value: "2", label: "≥ $2.00" },
                { value: "5", label: "≥ $5.00" },
              ]}
              onChange={v => setMinCpc(Number(v))}
            />
          </div>
          <Button variant="primary" onClick={handleRun} disabled={loading || !seeds.trim()} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
            {loading ? "Searching…" : "Discover"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {result?.error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", fontSize: "0.78rem", color: "#ef4444" }}>
          {result.error}
        </div>
      )}

      {/* Results */}
      {result && !result.error && (
        <>
          {/* Stats bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, padding: "8px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem" }}>
              <b style={{ color: "var(--fg)" }}>{result.keywords.length}</b>
              <span style={{ color: "var(--fg-subtle)" }}> keywords</span>
            </span>
            {Object.entries(intentCounts).map(([intent, n]) => {
              const cfg = INTENT_CFG[intent as keyof typeof INTENT_CFG];
              return (
                <span key={intent} style={{ fontSize: "0.75rem" }}>
                  <b style={{ color: cfg?.color ?? "var(--fg)" }}>{n}</b>
                  <span style={{ color: "var(--fg-subtle)" }}> {cfg?.label ?? intent}</span>
                </span>
              );
            })}
            <span style={{ fontSize: "0.72rem", color: "var(--fg-dim)" }}>API cost: ${result.cost.toFixed(4)}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => exportCsv(filtered)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: "var(--fg-subtle)", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
              <Download size={10} /> Export
            </button>
            <button onClick={() => {
              const csv = ["Keyword,Volume,CPC,Competition,Score,Intent", ...filtered.map(r => `"${r.keyword}",${r.volume},${r.cpc.toFixed(2)},${r.competitionLevel},${r.opportunityScore},${r.intent}`)].join("\n");
              navigator.clipboard.writeText(csv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
            }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: copied ? "#22c55e" : "var(--fg-subtle)", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>
              {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {(["all", "transactional", "commercial", "informational"] as IntentFilter[]).map(f => (
              <button key={f} className={`pill${intentFilter === f ? " on" : ""}`} onClick={() => setIntentFilter(f)}
                style={intentFilter === f && f !== "all" ? { background: `${INTENT_CFG[f as keyof typeof INTENT_CFG]?.bg}`, borderColor: `${INTENT_CFG[f as keyof typeof INTENT_CFG]?.border}`, color: INTENT_CFG[f as keyof typeof INTENT_CFG]?.color } : {}}>
                {f === "all" ? "All intent" : INTENT_CFG[f as keyof typeof INTENT_CFG]?.label}
                {f !== "all" && intentCounts[f] ? ` (${intentCounts[f]})` : ""}
              </button>
            ))}
            <button className={`pill${aiOnly ? " on" : ""}`} onClick={() => setAiOnly(v => !v)}>
              <Sparkles size={9} style={{ verticalAlign: "middle", marginRight: 3 }} />AI prompt
            </button>
            <div style={{ flex: 1 }} />
            <Dropdown value={sortKey} options={sortOptions} onChange={k => setSortKey(k as SortKey)} label="Sort" align="right" />
            <input className="kw-input" type="text" placeholder="Filter…" value={keyword} onChange={e => setKeyword(e.target.value)} />
            <span style={{ fontSize: "0.72rem", color: "var(--fg-dim)" }}>{filtered.length}</span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.82rem" }}>No keywords match your filters.</div>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg-elevated)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(165,182,214,0.02)" }}>
                    {[
                      { label: "Keyword", tip: "The search phrase people type into Google." },
                      { label: "Vol / mo", tip: "Monthly search volume. Lower is often better - less competition, easier to rank." },
                      { label: "CPC", tip: "Cost per click advertisers pay. High CPC = buyers are willing to pay for solutions - the strongest WTP signal." },
                      { label: "Competition", tip: "Advertiser competition. LOW = easier to rank organically too." },
                      { label: "Score", tip: "Opportunity score = volume × CPC ÷ competition. Higher = bigger prize for less effort." },
                      { label: "Intent", tip: "Buy = ready to pay now. Compare = evaluating options. Learn = researching." },
                      { label: "Action", tip: "Build a project targeting this keyword." },
                    ].map(({ label, tip }) => (
                      <th key={label} style={{ padding: "7px 12px", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                        <Tooltip content={<span style={{ fontSize: "0.74rem", lineHeight: 1.55 }}>{tip}</span>} width={220} side="bottom">
                          <span style={{ borderBottom: "1px dotted rgba(165,182,214,0.3)", cursor: "default" }}>{label}</span>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((kw, i) => {
                    const intentCfg = INTENT_CFG[kw.intent];
                    const compCfg = COMP_CFG[kw.competitionLevel] ?? COMP_CFG.UNKNOWN;
                    const isBuilding = buildingKw === kw.keyword;
                    return (
                      <tr key={kw.keyword} className="kw-row" style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", background: "transparent" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 500, color: "var(--fg)", fontSize: "0.85rem" }}>{kw.keyword}</span>
                            {kw.isAiPrompt && (
                              <Tooltip content="Good for AI-first content (ChatGPT / Perplexity)" width={200} side="bottom">
                                <span style={{ fontSize: "0.62rem", padding: "1px 5px", borderRadius: 3, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", cursor: "default" }}>AI</span>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {fmtVol(kw.volume)}
                        </td>
                        <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ color: kw.cpc >= 2 ? "#22c55e" : kw.cpc >= 1 ? "#f59e0b" : "var(--fg-muted)", fontWeight: kw.cpc >= 2 ? 700 : 400 }}>
                            ${kw.cpc.toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: compCfg.color }}>
                            {kw.competitionLevel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontVariantNumeric: "tabular-nums", color: kw.opportunityScore > 500 ? "#22c55e" : "var(--fg-muted)", fontWeight: kw.opportunityScore > 500 ? 700 : 400 }}>
                              {kw.opportunityScore.toLocaleString()}
                            </span>
                            <div style={{ width: 40, height: 3, background: "rgba(165,182,214,0.07)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, (kw.opportunityScore / (filtered[0]?.opportunityScore || 1)) * 100)}%`, background: "#22c55e", opacity: 0.6, borderRadius: 2 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: "0.69rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: intentCfg.bg, color: intentCfg.color, border: `1px solid ${intentCfg.border}` }}>
                            {intentCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {(kw.intent === "transactional" || kw.intent === "commercial") && (
                            <button
                              onClick={() => handleBuild(kw)}
                              disabled={isBuilding}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: "var(--radius)", border: "none", background: isBuilding ? "rgba(34,197,94,0.2)" : "#22c55e", color: isBuilding ? "#22c55e" : "#050d1e", fontSize: "0.71rem", fontWeight: 700, cursor: isBuilding ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                              {isBuilding ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : <Hammer size={9} />}
                              {isBuilding ? "Building…" : "Build"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ maxWidth: 400 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: "0.96rem", fontWeight: 600 }}>SEO keyword discovery</h2>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
              Enter a pain-based seed keyword. Get back what people are actually searching for - with volume, CPC, and intent. High CPC + transactional = someone will pay for a solution.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 480, justifyContent: "center" }}>
            {["quickbooks invoice export", "shift scheduling tool", "spreadsheet to app", "freelance lead tracking"].map(ex => (
              <button key={ex} onClick={() => setSeeds(s => s ? `${s}\n${ex}` : ex)}
                style={{ padding: "2px 10px", background: "rgba(165,182,214,0.04)", border: "1px solid var(--border)", borderRadius: 99, fontSize: "0.68rem", color: "var(--fg-subtle)", cursor: "pointer", fontFamily: "inherit" }}>
                + {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
