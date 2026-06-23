import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, FileText, Loader2, Upload, X, AlertTriangle, RefreshCw } from "lucide-react";
import { SiGoogleads, SiMeta, SiTiktok, SiX, SiSnapchat, SiPinterest, SiGoogleanalytics } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { CANONICAL_COLUMNS, type CanonicalRow, type NormalizeResult, type SchemaChange } from "../features/normalizer";
import { LogoMark } from "../components/logo-mark";

export const Route = createFileRoute("/")({ component: HomePage });

type RunResult = NormalizeResult & {
  csv: string;
  remaining: number;
  rowDiff?: number | null;
  schemaChanges: SchemaChange[];
  runId?: string;
};

// ─── Platform logos (react-icons / Simple Icons) ─────────────────────────────

type PlatformEntry = {
  name: string;
  color: string;
  darkColor?: string;
  Icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  img?: string;
};

const PLATFORMS: PlatformEntry[] = [
  { name: "Google Ads", color: "#4285F4", img: "/google-ads.svg" },
  { name: "Meta Ads", color: "#0081FB", Icon: SiMeta },
  { name: "TikTok", color: "#000000", img: "/tiktok.svg" },
  { name: "LinkedIn", color: "#0A66C2", Icon: FaLinkedin },
  { name: "X Ads", color: "#000000", darkColor: "#ffffff", Icon: SiX },
  { name: "Snapchat", color: "#FFFC00", Icon: SiSnapchat },
  { name: "Pinterest", color: "#E60023", Icon: SiPinterest },
  { name: "GA4", color: "#E37400", Icon: SiGoogleanalytics },
];

// Render a platform logo - handles img-based and icon-based entries
function PlatformLogo({ p, size = 36 }: { p: PlatformEntry; size?: number }) {
  if (p.img) {
    return <img src={p.img} alt={p.name} width={size} height={size} className="object-contain" />;
  }
  if (p.Icon) {
    // For black icons, use CSS to invert in dark mode
    const needsDarkInvert = p.darkColor === "#ffffff";
    return (
      <p.Icon
        size={size}
        style={{ color: p.color }}
        className={needsDarkInvert ? "dark:invert" : undefined}
      />
    );
  }
  return null;
}

// ─── Flow diagram ────────────────────────────────────────────────────────────

const FLOW_PLATFORMS = [
  { name: "Google Ads", color: "#4285F4", img: "/google-ads.svg" },
  { name: "Meta Ads", color: "#0081FB", Icon: SiMeta },
  { name: "TikTok", color: "#000000", img: "/tiktok.svg" },
  { name: "LinkedIn", color: "#0A66C2", Icon: FaLinkedin },
  { name: "X Ads", color: "#6B7280", darkColor: "#ffffff", Icon: SiX },
  { name: "Snapchat", color: "#EAB308", Icon: SiSnapchat },
  { name: "Pinterest", color: "#E60023", Icon: SiPinterest },
  { name: "GA4", color: "#E37400", Icon: SiGoogleanalytics },
] satisfies PlatformEntry[];

const TABLE_ROWS = [
  { date: "2026-05-11", platform: "Google Ads", spend: "$541", clicks: "834", roas: "3.2x" },
  { date: "2026-05-11", platform: "Meta Ads", spend: "$1,106", clicks: "892", roas: "2.9x" },
  { date: "2026-05-11", platform: "TikTok", spend: "$2,564", clicks: "3,126", roas: "1.5x" },
  { date: "2026-05-11", platform: "LinkedIn", spend: "$1,459", clicks: "384", roas: "1.8x" },
];

function FlowDiagram() {
  // SVG viewBox: 1000 x 380
  const W = 1000;
  const H = 380;
  const N = FLOW_PLATFORMS.length;

  // Platform icons: left column
  const platformX = 120;
  const platformSpacing = (H - 60) / (N - 1);
  const platformY = (i: number) => 30 + i * platformSpacing;

  // Logo center
  const logoX = W / 2;
  const logoY = H / 2;

  // Table: right side
  const tableX = 720;
  const tableRowH = 42;
  const tableTop = logoY - (TABLE_ROWS.length * tableRowH) / 2;

  // Bezier path: platform → logo
  function inPath(i: number) {
    const sy = platformY(i);
    return `M ${platformX + 20} ${sy} C ${platformX + 120} ${sy}, ${logoX - 120} ${logoY}, ${logoX - 60} ${logoY}`;
  }

  // Bezier path: logo → table row
  function outPath(i: number) {
    const ey = tableTop + i * tableRowH + tableRowH / 2;
    return `M ${logoX + 60} ${logoY} C ${logoX + 120} ${logoY}, ${tableX - 60} ${ey}, ${tableX} ${ey}`;
  }

  const durations = [2.0, 2.3, 1.8, 2.5, 2.1, 1.9, 2.4, 2.2];
  const outDurations = [1.8, 2.0, 2.2, 2.4];

  return (
    <div className="hidden lg:block relative w-full select-none" style={{ height: H }}>
      {/* Platform logos - left */}
      {FLOW_PLATFORMS.map((p, i) => (
        <div
          key={p.name}
          className="absolute flex items-center gap-2"
          style={{ left: 0, top: platformY(i) - 14, width: platformX + 10 }}
        >
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <PlatformLogo p={p} size={20} />
          </div>
          <span className="text-[11px] font-mono text-fg-subtle leading-tight truncate">
            {p.name.replace(" Ads", "")}
          </span>
        </div>
      ))}

      {/* Logo - center */}
      <div
        className="absolute z-10"
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <LogoMark size={80} className="drop-shadow-sm" />
      </div>

      {/* Output table - right */}
      <div
        className="absolute border border-border bg-bg-elevated shadow-sm overflow-hidden"
        style={{ left: tableX, top: tableTop, width: 268, borderRadius: 2 }}
      >
        <div className="grid grid-cols-5 border-b border-border bg-bg-elevated/80 px-2 py-1.5">
          {["date", "platform", "spend", "clicks", "roas"].map((h) => (
            <span key={h} className="text-[10px] font-mono text-fg-subtle uppercase tracking-wide">{h}</span>
          ))}
        </div>
        {TABLE_ROWS.map((r, i) => {
          const pl = FLOW_PLATFORMS.find((p) => p.name.startsWith(r.platform.split(" ")[0]!));
          return (
            <div
              key={i}
              className="grid grid-cols-5 px-2 py-1.5 border-b border-border/50 last:border-0"
              style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgb(var(--bg-elevated) / 0.4)" }}
            >
              <span className="text-[10px] font-mono text-fg-subtle">{r.date.slice(5)}</span>
              <span className="flex items-center gap-1">
                {pl && <PlatformLogo p={pl as PlatformEntry} size={10} />}
                <span className="text-[10px] font-mono text-fg truncate">{r.platform.split(" ")[0]}</span>
              </span>
              <span className="text-[10px] font-mono text-fg">{r.spend}</span>
              <span className="text-[10px] font-mono text-fg">{r.clicks}</span>
              <span className="text-[10px] font-mono text-primary font-medium">{r.roas}</span>
            </div>
          );
        })}
        <div className="px-2 py-1.5 bg-primary/5 border-t border-primary/20">
          <span className="text-[10px] font-mono text-primary">normalized.csv - 4 platforms merged</span>
        </div>
      </div>

      {/* SVG overlay - connecting paths + animated dots */}
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
      >
        {/* In-paths: platform → logo */}
        {FLOW_PLATFORMS.map((p, i) => (
          <g key={p.name}>
            <path
              d={inPath(i)}
              stroke={p.color === "#000000" ? "#6B7280" : p.color}
              strokeWidth="1.5"
              fill="none"
              strokeOpacity="0.25"
              strokeDasharray="5 4"
            />
            <circle r="3" fill={p.color === "#000000" ? "#6B7280" : p.color} fillOpacity="0.9">
              <animateMotion
                dur={`${durations[i]}s`}
                repeatCount="indefinite"
                path={inPath(i)}
                calcMode="spline"
                keySplines="0.4 0 0.6 1"
                keyTimes="0;1"
              />
            </circle>
          </g>
        ))}

        {/* Out-paths: logo → table rows */}
        {TABLE_ROWS.map((_, i) => (
          <g key={i}>
            <path
              d={outPath(i)}
              stroke="#047857"
              strokeWidth="1.5"
              fill="none"
              strokeOpacity="0.3"
              strokeDasharray="5 4"
            />
            <circle r="2.5" fill="#047857" fillOpacity="0.85">
              <animateMotion
                dur={`${outDurations[i % outDurations.length]}s`}
                begin={`${i * 0.35}s`}
                repeatCount="indefinite"
                path={outPath(i)}
                calcMode="spline"
                keySplines="0.4 0 0.6 1"
                keyTimes="0;1"
              />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

function HomePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const csvs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...csvs.filter((f) => !names.has(f.name))];
    });
  }

  const [loadingSamples, setLoadingSamples] = useState(false);

  async function loadSampleData() {
    setLoadingSamples(true);
    const fileNames = [
      "google_ads_export.csv",
      "meta_ads_export.csv",
      "tiktok_ads_export.csv",
      "linkedin_ads_export.csv",
      "x_ads_export.csv",
      "snapchat_ads_export.csv",
      "pinterest_ads_export.csv",
      "ga4_export.csv",
    ];
    try {
      const fetched = await Promise.all(
        fileNames.map(async (name) => {
          const res = await fetch(`/sample-data/${name}`);
          const blob = await res.blob();
          return new File([blob], name, { type: "text/csv" });
        }),
      );
      const list = new DataTransfer();
      for (const f of fetched) list.items.add(f);
      addFiles(list.files);
    } catch {
      // silently ignore - network failure unlikely in local dev
    } finally {
      setLoadingSamples(false);
    }
  }

  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  useEffect(() => {
    function blockBrowserDefault(e: DragEvent) { e.preventDefault(); }
    window.addEventListener("dragover", blockBrowserDefault);
    window.addEventListener("drop", blockBrowserDefault);
    return () => {
      window.removeEventListener("dragover", blockBrowserDefault);
      window.removeEventListener("drop", blockBrowserDefault);
    };
  }, []);

  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;
    let counter = 0;
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); counter++; setDragging(true); };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDragLeave = () => { counter--; if (counter <= 0) { counter = 0; setDragging(false); } };
    const onDrop = (e: DragEvent) => { e.preventDefault(); counter = 0; setDragging(false); addFilesRef.current(e.dataTransfer?.files ?? null); };
    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function run(overrides?: Record<string, Record<string, string | null>>, saveMappings?: boolean) {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    for (const f of files) form.append("files", f);
    if (overrides) form.append("mappingOverrides", JSON.stringify(overrides));
    if (saveMappings !== undefined) form.append("saveMappings", String(saveMappings));
    try {
      const res = await fetch("/api/normalize", { method: "POST", body: form });
      const json = (await res.json()) as RunResult & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        // If logged in and have a runId, go straight to the table view
        if (json.runId) {
          navigate({ to: "/dashboard/run/$runId", params: { runId: json.runId } });
          return;
        }
        setResult(json);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reportfuse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!result?.rows?.length) return;
    const ws = XLSX.utils.json_to_sheet(result.rows, { header: [...CANONICAL_COLUMNS] });
    // Set column widths (approximate character widths)
    ws["!cols"] = [
      { wch: 12 }, // date
      { wch: 14 }, // platform
      { wch: 30 }, // campaign
      { wch: 24 }, // adset
      { wch: 24 }, // ad
      { wch: 10 }, // spend
      { wch: 12 }, // impressions
      { wch: 10 }, // clicks
      { wch: 8 },  // cpc
      { wch: 8 },  // ctr
      { wch: 12 }, // conversions
      { wch: 8 },  // roas
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ReportFuse");
    XLSX.writeFile(wb, `reportfuse-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div id="top" className="min-h-screen bg-bg">
      {/* ── Hero + Drop zone - combined, above the fold ───────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-0">
        {/* Brand lockup */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <LogoMark size={38} />
          <span className="font-display font-light text-fg tracking-tight" style={{ fontSize: "1.35rem", letterSpacing: "-0.02em" }}>
            Report<span className="text-primary">Fuse</span>
          </span>
        </div>

        {/* Compact headline */}
        <div className="text-center mb-8">
          <h1
            className="font-display font-light text-fg leading-[1.08] tracking-tight mb-3"
            style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)", letterSpacing: "-0.03em" }}
          >
            All marketing data.
            <br />
            <span className="text-primary">One clean table.</span>
          </h1>
          <p className="text-base text-fg-muted font-light max-w-md mx-auto">
            Drop CSV exports from any ad platform. AI maps every column to one unified schema - even when platforms change their names.
          </p>
        </div>

        <input
          id="file-upload"
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <input id="file-upload-hero" type="file" accept=".csv" multiple className="sr-only"
          onChange={(e) => addFiles(e.target.files)} />

        <div
          ref={dropZoneRef}
          className={`relative border-2 border-dashed transition-all ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 bg-bg-elevated/60"
            }`}
          style={{ minHeight: "220px" }}
        >
          {files.length === 0 ? (
            /* Empty state - centered */
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="pointer-events-none mb-5">
                <Upload size={28} className="mx-auto mb-3 text-fg-muted" strokeWidth={1.5} />
                <p className="text-lg font-display font-light text-fg tracking-tight mb-1">
                  Drop your CSV exports here
                </p>
                <p className="text-xs text-fg-muted">
                  Google Ads, Meta, TikTok, LinkedIn, X, Snapchat, Pinterest, GA4
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-fg bg-primary border border-primary cursor-pointer hover:brightness-110 transition-all">
                  <Upload size={13} /> Browse files
                </label>
                {!result && (
                  <button type="button" onClick={loadSampleData} disabled={loadingSamples}
                    className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50 transition-colors">
                    {loadingSamples ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                    {loadingSamples ? "Loading…" : "Try sample data"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* File list - in-place, same box */
            <div className="p-4">
              <ul className="space-y-1 mb-3">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 px-3 py-2 bg-bg border border-border hover:bg-hover transition-colors">
                    <FileText size={13} className="text-primary shrink-0" />
                    <span className="flex-1 text-fg truncate font-mono text-xs">{f.name}</span>
                    <span className="text-[10px] text-fg-subtle shrink-0 font-mono">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                      className="text-fg-muted hover:text-danger transition-colors shrink-0 p-0.5"
                      aria-label={`Remove ${f.name}`}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between px-1">
                <label htmlFor="file-upload"
                  className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                  <Upload size={11} /> Add more files
                </label>
                <button type="button"
                  onClick={() => { setFiles([]); setResult(null); setError(null); }}
                  className="text-xs text-fg-subtle hover:text-fg transition-colors">
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => run()}
            disabled={!files.length || loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-primary-fg bg-primary hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-primary"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {loading ? "Processing…" : "Clean & merge"}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-danger/8 border border-danger/25 text-sm text-danger">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </section>

      {/* ── Platform logos - below drop zone ─────────────────────────────── */}
      {!result && (
        <section className="border-t border-border bg-bg-elevated/30 py-6 mt-6">
          <div className="max-w-3xl mx-auto px-6">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-6 items-center justify-items-center mb-4">
              {PLATFORMS.map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-2">
                  <PlatformLogo p={p} size={40} />
                  <span className="text-xs text-fg-muted font-mono hidden sm:block text-center whitespace-nowrap">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-fg-subtle">
              Works with any platform that exports CSVs - Bing Ads, Amazon Ads, DV360, Criteo and more.
            </p>
          </div>
        </section>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="max-w-5xl mx-auto px-6 pb-20">
          <div className="border-t border-border pt-10">
            <ResultView
              result={result}
              onDownload={downloadCSV}
              onDownloadXLSX={downloadXLSX}
              onReNormalize={(overrides, save) => run(overrides, save)}
              hasFiles={files.length > 0}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* ── Marketing sections - only before first run ────────────────────── */}
      {!result && (
        <>
          {/* How it works - 3 step rows */}
          <section id="how-it-works" className="border-t border-border">
            <div className="max-w-5xl mx-auto px-6 py-20">
              <div className="mb-16 max-w-2xl">
                <p className="font-mono text-xs text-fg-subtle uppercase tracking-widest mb-4">002 / How it works</p>
                <h2 className="font-display font-semibold text-fg" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.025em" }}>
                  Three steps. Roughly eight seconds.
                </h2>
              </div>
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <HowItWorksStep key={step.num} step={step} flipped={i % 2 === 1} />
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="border-y border-border bg-bg-elevated/50">
            <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-2 sm:grid-cols-4">
              {[
                { kpi: "12h+", label: "back every week", sub: "based on user-reported time saved" },
                { kpi: "8+", label: "platforms supported", sub: "plus any CSV the model can read" },
                { kpi: "< 10s", label: "upload to clean CSV", sub: "typical multi-platform batch" },
                { kpi: ">99%", label: "column-mapping accuracy", sub: "on named platform schemas" },
              ].map((s, i) => (
                <div key={s.kpi} className={`px-8 py-6 ${i > 0 ? "border-l border-border" : ""}`}>
                  <div className="font-display font-semibold text-fg leading-none mb-2" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em' }}>{s.kpi}</div>
                  <div className="text-sm text-fg font-medium mb-1">{s.label}</div>
                  <div className="font-mono text-[10px] text-fg-subtle">{s.sub}</div>
                </div>
              ))}
            </div>
          </section>



          {/* Final CTA */}
          <section id="cta" className="border-t border-border bg-bg-elevated/50 py-16 text-center">
            <h2 className="font-display font-semibold text-4xl sm:text-5xl text-fg tracking-tight mb-3" style={{ letterSpacing: '-0.03em' }}>
              Ready to get your time back?
            </h2>
            <p className="text-base text-fg-muted mb-8">Free for 3 runs a day. No credit card required.</p>
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium text-primary-fg bg-primary border border-primary cursor-pointer hover:brightness-110 transition-all"
            >
              <Upload size={15} />
              Upload your first CSV
            </label>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 pt-14 pb-8 grid grid-cols-1 sm:grid-cols-4 gap-10">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <LogoMark size={32} />
              <span className="font-display font-light text-fg tracking-tight" style={{ fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
                Report<span className="text-primary">Fuse</span>
              </span>
            </div>
            <p className="text-sm text-fg-muted font-light max-w-xs">Every marketing platform. One clean table.</p>
          </div>
          {[
            { title: "Product", links: [{ label: "How it works", href: "#how-it-works" }, { label: "Pricing", href: "/pricing" }, { label: "Dashboard", href: "/dashboard" }] },
            { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
          ].map((g) => (
            <div key={g.title}>
              <div className="font-mono text-[10px] text-fg-subtle tracking-widest uppercase mb-4">{g.title}</div>
              <ul className="space-y-3">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-fg-muted hover:text-fg transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="font-mono text-[11px] text-fg-subtle">&copy; {new Date().getFullYear()} ReportFuse. Not affiliated with Google, Meta, TikTok, LinkedIn, X Corp, Snap Inc., or Pinterest.</span>
          <span className="font-mono text-[11px] text-fg-subtle">all systems normal</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

type Overrides = Record<string, Record<string, string | null>>;

function ResultView({
  result, onDownload, onDownloadXLSX, onReNormalize, hasFiles, loading,
}: {
  result: RunResult;
  onDownload: () => void;
  onDownloadXLSX: () => void;
  onReNormalize: (overrides: Overrides, save: boolean) => void;
  hasFiles: boolean;
  loading: boolean;
}) {
  const { rows, platformsDetected, columnMappings, warnings, remaining, rowDiff, schemaChanges } = result;
  const [pendingOverrides, setPendingOverrides] = useState<Overrides>({});
  const [saveMappings, setSaveMappings] = useState(true);

  const hasOverrides = Object.values(pendingOverrides).some((m) => Object.keys(m).length > 0);

  function setOverride(fileName: string, src: string, canon: string | null) {
    setPendingOverrides((prev) => ({
      ...prev,
      [fileName]: { ...(prev[fileName] ?? {}), [src]: canon },
    }));
  }

  return (
    <div className="space-y-6">
      {/* Download - the hero action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
        <div>
          <p className="text-2xl font-display font-light text-fg tracking-tight">
            {rows.length.toLocaleString()} rows ready
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {platformsDetected.map((p) => {
              const pl = PLATFORMS.find((x) => x.name === p);
              return (
                <span key={p} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 bg-primary/8 text-primary border border-primary/20 font-mono">
                  {pl && <PlatformLogo p={pl} size={11} />}{p}
                </span>
              );
            })}
            {remaining <= 0 && (
              <a href="/login" className="text-xs text-primary hover:underline">Sign in for unlimited runs</a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onDownload}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-primary-fg bg-primary hover:brightness-110 transition-all border border-primary">
            <Download size={14} /> Download CSV
          </button>
          <button type="button" onClick={onDownloadXLSX}
            className="flex items-center gap-2 px-4 py-3 text-sm text-fg bg-bg-elevated hover:bg-hover transition-all border border-border">
            <Download size={14} /> XLSX
          </button>
        </div>
      </div>

      {/* Secondary info - warnings, schema changes */}
      {(schemaChanges?.length > 0 || warnings.length > 0) && (
        <div className="space-y-1.5">
          {schemaChanges?.map((sc) => (
            <div key={sc.platform} className="flex items-start gap-2 px-3 py-2 bg-warning/8 border border-warning/25 text-xs text-warning">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{sc.platform}: {sc.message}</span>
            </div>
          ))}
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 px-3 py-2 bg-warning/8 border border-warning/25 text-xs text-warning">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}
            </div>
          ))}
        </div>
      )}

      {/* Mapping summary - read-only */}
      {Object.keys(columnMappings).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-mono text-fg-subtle uppercase tracking-widest">Mappings applied</h3>
          {Object.entries(columnMappings).map(([fileName, mapping]) => (
            <MappingCard key={fileName} fileName={fileName} mapping={mapping} />
          ))}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-3">Preview</h3>
          <DataTable rows={rows.slice(0, 10)} />
        </div>
      )}
      {rows.length === 0 && (
        <div className="py-10 text-center border border-border bg-bg-elevated text-sm text-fg-muted">
          No data rows extracted. Check that your CSVs have data below the header row.
        </div>
      )}
    </div>
  );
}

// ─── Mapping card (read-only) ─────────────────────────────────────────────────

function MappingCard({ fileName, mapping }: { fileName: string; mapping: Record<string, string | null> }) {
  const mapped = Object.entries(mapping).filter(([, v]) => v !== null);
  const unmapped = Object.entries(mapping).filter(([, v]) => v === null);

  return (
    <div className="border border-border">
      <div className="px-3 py-1.5 bg-bg-elevated border-b border-border text-xs font-mono text-fg-muted">{fileName}</div>
      <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
        {mapped.map(([src, canon]) => (
          <span key={src} className="text-xs px-2 py-0.5 bg-success/8 border border-success/20 text-fg">
            <span className="text-fg-muted">{src}</span>
            <span className="mx-1 text-fg-subtle">→</span>
            <span className="font-mono text-primary">{canon}</span>
          </span>
        ))}
        {unmapped.map(([src]) => (
          <span key={src} className="text-xs px-2 py-0.5 bg-bg-elevated border border-border text-fg-muted line-through">{src}</span>
        ))}
      </div>
    </div>
  );
}

function DataTable({ rows }: { rows: CanonicalRow[] }) {
  const visibleCols = CANONICAL_COLUMNS;
  const hasData = (c: (typeof CANONICAL_COLUMNS)[number]) => rows.some((r) => r[c] !== null && r[c] !== "");
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-bg-elevated">
            {visibleCols.map((c) => (
              <th key={c} className={`px-3 py-2.5 text-left font-mono font-medium whitespace-nowrap ${hasData(c) ? "text-fg-muted" : "text-fg-subtle/40"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-border last:border-0 hover:bg-hover transition-colors ${i % 2 === 0 ? "bg-bg" : "bg-bg-elevated/40"}`}>
              {visibleCols.map((c) => {
                const val = row[c];
                const isNum = typeof val === "number";
                return (
                  <td key={c} className={`px-3 py-2 text-fg whitespace-nowrap ${isNum ? "font-mono text-right" : ""}`}>
                    {val === null || val === undefined || val === ""
                      ? <span className="text-fg-subtle">-</span>
                      : isNum ? fmtNum(c, val as number) : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    num: "01",
    eyebrow: "Upload",
    title: "Drop any CSV. Or twelve.",
    body: "Drag in exports from Google Ads, Meta, TikTok, LinkedIn - anything that produces a flat file. Mix platforms, mix date ranges. Mismatched columns are fine.",
    bullets: ["Multi-file batch upload", "No platform connectors to configure", "Any date range, any account"],
    visual: "upload" as const,
  },
  {
    num: "02",
    eyebrow: "Normalize",
    title: "The model reads each column.",
    body: 'Not name-matching. Actual semantic understanding. "Amount spent (USD)", "Cost", "Total cost" and "Spend" all collapse to a single canonical column.',
    bullets: ["12-column canonical schema", "Handles renamed columns automatically", "Type inference + unit detection"],
    visual: "normalize" as const,
  },
  {
    num: "03",
    eyebrow: "Export",
    title: "One clean table out.",
    body: "Review the mapping, correct anything the AI got wrong, and save it - so next week's run skips the AI entirely for that platform.",
    bullets: ["CSV + XLSX download", "Remembered mappings for repeat runs", "Diff vs last run + schema-change alerts"],
    visual: "export" as const,
  },
];

function HowItWorksStep({ step, flipped }: { step: typeof HOW_IT_WORKS_STEPS[number]; flipped: boolean }) {
  return (
    <div className="grid sm:grid-cols-2 gap-12 lg:gap-20 py-14 border-t border-border items-center">
      <div style={{ order: flipped ? 2 : 1 }}>
        <div
          className="font-display font-bold leading-none select-none mb-0 -ml-1"
          style={{ fontSize: "clamp(80px, 14vw, 160px)", letterSpacing: "-0.05em", lineHeight: 0.85, color: "rgb(var(--border))", marginBottom: -24 }}
        >
          {step.num}
        </div>
        <p className="font-mono text-[10px] text-fg-subtle uppercase tracking-widest mb-3">{step.eyebrow}</p>
        <h3 className="font-display font-semibold text-fg mb-4" style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {step.title}
        </h3>
        <p className="text-sm text-fg-muted leading-relaxed mb-5 font-light max-w-md">{step.body}</p>
        <ul className="space-y-2">
          {step.bullets.map((b) => (
            <li key={b} className="font-mono text-xs text-fg-muted flex items-baseline gap-3">
              <span className="text-primary shrink-0">-</span>{b}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: flipped ? 1 : 2 }}>
        <HowItWorksVisual kind={step.visual} />
      </div>
    </div>
  );
}

function HowItWorksVisual({ kind }: { kind: "upload" | "normalize" | "export" }) {
  if (kind === "upload") {
    return (
      <div className="border border-dashed border-border-strong p-5 bg-bg-elevated/50 flex flex-col gap-1.5">
        <p className="font-mono text-[10px] text-fg-subtle uppercase tracking-widest mb-2">Drop zone · 4 files queued</p>
        {[
          { name: "gads-q2-search.csv", size: "14.2 MB", rows: "124,802 rows" },
          { name: "meta-prospecting.csv", size: "8.7 MB", rows: "62,100 rows" },
          { name: "tt-spark-ads.csv", size: "3.1 MB", rows: "21,488 rows" },
          { name: "linkedin-abm-q2.csv", size: "1.2 MB", rows: "8,920 rows" },
        ].map((f) => (
          <div key={f.name} className="grid items-center gap-2 px-3 py-2 bg-bg border border-border font-mono text-xs" style={{ gridTemplateColumns: "1fr auto auto" }}>
            <span className="truncate text-fg">{f.name}</span>
            <span className="text-fg-subtle">{f.size}</span>
            <span className="text-fg-muted">{f.rows}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1 bg-border">
            <div className="h-full bg-primary" style={{ width: "68%" }} />
          </div>
          <span className="font-mono text-[10px] text-fg-subtle">68%</span>
        </div>
      </div>
    );
  }

  if (kind === "normalize") {
    return (
      <div className="border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-bg-elevated/60">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest">Semantic Map</span>
          <span className="font-mono text-[10px] text-fg-subtle">gemini-flash · 1.2s</span>
        </div>
        {[
          { src: "Amount spent (USD)", canon: "spend", conf: 99 },
          { src: "Cost", canon: "spend", conf: 97 },
          { src: "Total cost", canon: "spend", conf: 96 },
          { src: "Reporting starts", canon: "date", conf: 94 },
          { src: "Conv. value / cost", canon: "roas", conf: 88 },
          { src: "Purchase ROAS", canon: "roas", conf: 99 },
          { src: "Link clicks", canon: "clicks", conf: 98 },
        ].map((ex, i, arr) => (
          <div
            key={ex.src}
            className={`grid items-center px-4 py-2 font-mono text-xs ${i < arr.length - 1 ? "border-b border-border" : ""}`}
            style={{ gridTemplateColumns: "1fr 28px 80px 32px" }}
          >
            <span className="text-fg truncate">{ex.src}</span>
            <span className="text-fg-subtle text-center">→</span>
            <span className="text-primary font-medium">{ex.canon}</span>
            <span className="text-fg-subtle text-right">{ex.conf}%</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <span className="font-mono text-xs font-semibold">unified-2026-05-11.csv</span>
        <span className="font-mono text-[10px] px-2 py-0.5 bg-success/10 text-success border border-success/20">218,330 rows</span>
      </div>
      <div className="overflow-x-auto">
        {[
          "date,platform,campaign,spend,impressions,clicks,ctr,conversions,roas",
          "2026-05-01,gads,Brand - Exact,541.10,12450,834,6.70%,42,3.84",
          "2026-05-01,meta,Retargeting - Cart,1106.08,34820,892,2.56%,38,3.21",
          "2026-05-01,tikt,Brand Awareness Q2,2563.32,284500,3126,1.10%,28,1.45",
          "2026-05-01,lnkd,Sponsored Content,1459.20,48200,384,0.80%,12,-",
        ].map((line, i) => (
          <div
            key={i}
            className={`px-4 py-1.5 font-mono text-[10px] border-b border-border whitespace-nowrap last:border-0 ${i === 0 ? "bg-bg-elevated text-fg-subtle" : "text-fg"}`}
          >
            {line}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        {["CSV", "XLSX"].map((f, i) => (
          <span key={f} className={`font-mono text-[11px] px-3 py-1 border cursor-pointer ${i === 0 ? "bg-fg text-bg border-fg" : "border-border text-fg-muted hover:text-fg transition-colors"}`}>{f}</span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(col: string, val: number): string {
  if (col === "spend" || col === "cpc") return `$${val.toFixed(2)}`;
  if (col === "ctr") return `${val.toFixed(2)}%`;
  if (col === "roas") return `${val.toFixed(2)}x`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}
