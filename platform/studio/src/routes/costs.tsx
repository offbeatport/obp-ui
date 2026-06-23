import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { getAiCostStats } from "~/lib/project-fns";
import type { AiCostStats } from "~/lib/project-fns";
import { MODEL_PRICES } from "~/lib/cost-tracker";

export const Route = createFileRoute("/costs")({
  loader: async () => getAiCostStats(),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: CostsPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(usd: number, digits = 4): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(digits)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CALL_TYPE_LABELS: Record<string, string> = {
  "generation": "Generation",
  "keyword-gen": "Keyword gen",
  "channel-suggestions": "Channel suggestions",
  "brief": "Brief",
  "clustering": "Clustering",
  "refine-clustering": "Refine - clustering",
  "refine-brief": "Refine - brief",
  "prescore": "Pre-score",
  "content-gen": "Content gen",
};

// ── OpenRouter credits ────────────────────────────────────────────────────────

interface ORKeyInfo {
  label?: string;
  usage?: number;      // USD used total
  limit?: number | null; // USD credit limit (null = unlimited)
  is_free_tier?: boolean;
  rate_limit?: { requests: number; interval: string };
}

function CreditsBar() {
  const [info, setInfo] = useState<ORKeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/openrouter-key-info")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { data: ORKeyInfo }) => { setInfo(d.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return <div style={{ height: 72, display: "flex", alignItems: "center" }}><span style={{ fontSize: "0.76rem", color: "rgba(165,182,214,0.3)" }}>Fetching OpenRouter balance…</span></div>;
  if (error || !info) return null;

  const used = info.usage ?? 0;
  const limit = info.limit ?? null;
  const remaining = limit !== null ? Math.max(0, limit - used) : null;
  const pct = limit ? Math.min((used / limit) * 100, 100) : null;
  const barColor = pct !== null ? (pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e") : "var(--accent)";

  return (
    <div style={{ marginBottom: 32, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", marginBottom: 14 }}>
        OpenRouter account
      </div>
      <div style={{ display: "flex", gap: 48, marginBottom: limit ? 16 : 0 }}>
        <div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "#ef4444", fontVariantNumeric: "tabular-nums", marginBottom: 5 }}>
            ${used.toFixed(4)}
          </div>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>All-time (OpenRouter)</div>
        </div>
        {remaining !== null && (
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "rgba(165,182,214,0.6)", fontVariantNumeric: "tabular-nums", marginBottom: 5 }}>
              ${remaining.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>Remaining</div>
          </div>
        )}
        {limit !== null && (
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "rgba(165,182,214,0.3)", fontVariantNumeric: "tabular-nums", marginBottom: 5 }}>
              ${limit.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>Rate limit / period</div>
          </div>
        )}
        {info.rate_limit && (
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "rgba(165,182,214,0.3)", fontVariantNumeric: "tabular-nums", marginBottom: 5 }}>
              {info.rate_limit.requests.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>
              Requests / {info.rate_limit.interval}
            </div>
          </div>
        )}
        {info.is_free_tier && (
          <div style={{ alignSelf: "center" }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>Free tier</span>
          </div>
        )}
      </div>
      {pct !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: "0.66rem", color: "rgba(165,182,214,0.35)", whiteSpace: "nowrap" }}>{pct.toFixed(1)}% used</span>
        </div>
      )}
    </div>
  );
}

// ── Call log with expandable rows ────────────────────────────────────────────

type RecentEntry = AiCostStats["recentEntries"][number];

function CallRow({ r }: { r: RecentEntry }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"prompt" | "response">("prompt");
  const hasContent = r.promptText || r.responseText;

  return (
    <>
      <tr
        onClick={() => hasContent && setOpen(v => !v)}
        style={{
          borderBottom: open ? "none" : "1px solid rgba(255,255,255,0.04)",
          cursor: hasContent ? "pointer" : "default",
          background: open ? "rgba(255,255,255,0.03)" : "transparent",
        }}>

        {/* Expand arrow */}
        <td style={{ padding: "10px 8px 10px 0", width: 20 }}>
          {hasContent && (
            <span style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.3)", transform: open ? "rotate(90deg)" : "none", display: "inline-block" }}>▶</span>
          )}
        </td>
        <td style={{ padding: "10px 10px", fontSize: "0.72rem", color: "rgba(165,182,214,0.3)", whiteSpace: "nowrap" }}>
          {relTime(r.createdAt)}
        </td>
        <td style={{ padding: "10px 10px", fontSize: "0.75rem", fontFamily: "monospace", color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
          {r.model.split("/").pop()}
          <span style={{ marginLeft: 5, fontSize: "0.60rem", color: "rgba(165,182,214,0.28)" }}>{r.model.split("/")[0]}</span>
        </td>
        <td style={{ padding: "10px 10px", fontSize: "0.74rem", color: "rgba(165,182,214,0.5)" }}>
          {CALL_TYPE_LABELS[r.callType] ?? r.callType}
        </td>
        <td style={{ padding: "10px 10px", fontSize: "0.73rem", color: "rgba(165,182,214,0.4)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {fmtTokens(r.promptTokens)} → {fmtTokens(r.completionTokens)}
        </td>
        <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: r.costUsd > 0.001 ? "#ef4444" : "rgba(165,182,214,0.4)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {fmt(r.costUsd)}
        </td>
      </tr>

      {/* Expanded prompt / response */}
      {open && (
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <td colSpan={6} style={{ padding: "0 0 0 28px" }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
              {(["prompt", "response"] as const).map(t => (
                <Button
                  key={t}
                  variant={tab === t ? "outline" : "ghost"}
                  size="sm"
                  onClick={e => { e.stopPropagation(); setTab(t); }}
                  style={{
                    fontSize: "0.66rem", fontWeight: tab === t ? 700 : 400,
                    color: tab === t ? "var(--fg-muted)" : "rgba(165,182,214,0.35)",
                    textTransform: "capitalize",
                  }}
                >
                  {t} {t === "prompt" ? `(${fmtTokens(r.promptTokens)} tok)` : `(${fmtTokens(r.completionTokens)} tok)`}
                </Button>
              ))}
            </div>
            {/* Content */}
            <pre style={{
              margin: "0 0 12px",
              padding: "12px 14px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 6,
              fontSize: "0.72rem",
              color: "rgba(165,182,214,0.7)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 400,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              {tab === "prompt"
                ? (r.promptText ?? "(not recorded)")
                : (r.responseText ?? "(not recorded)")}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function CallLog({ entries }: { entries: RecentEntry[] }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", marginBottom: 12 }}>
        Call log - last {entries.length}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["", "When", "Model", "Type", "Tokens", "Cost"].map((h, i) => (
              <th key={i} style={{ padding: "0 10px 8px", textAlign: h === "Cost" ? "right" : "left", fontSize: "0.57rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", borderBottom: "1px solid var(--border)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(r => <CallRow key={r.id} r={r} />)}
        </tbody>
      </table>
      <p style={{ margin: "10px 0 0", fontSize: "0.68rem", color: "rgba(165,182,214,0.22)" }}>
        Click a row to see the full prompt and response.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function CostsPage() {
  const stats = Route.useLoaderData() as AiCostStats;

  const knownTotal = stats.last7DaysUsd;
  const hasData = stats.byModel.length > 0 || stats.recentEntries.length > 0;

  // Static reference rows for models we use (so the page is useful even with no data yet)
  const staticModels = Object.entries(MODEL_PRICES).filter(([m]) =>
    ["anthropic/claude-sonnet-4-6", "anthropic/claude-haiku-4-5", "google/gemini-3.1-flash-lite-preview", "openai/text-embedding-3-small"].includes(m)
  );

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--fg)" }}>Costs</h1>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(165,182,214,0.45)" }}>
            AI spend tracked from every OpenRouter call. Prices are calculated locally from token counts.
          </p>
        </div>

        {/* OpenRouter account balance */}
        <CreditsBar />

        {/* Summary numbers */}
        <div style={{ display: "flex", gap: 52, marginBottom: 36, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: knownTotal > 0 ? "#ef4444" : "rgba(165,182,214,0.2)", fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
              {fmt(knownTotal, 2)}
            </div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>Last 7 days</div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: stats.last30DaysUsd > 0 ? "rgba(239,68,68,0.6)" : "rgba(165,182,214,0.2)", fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
              {fmt(stats.last30DaysUsd, 2)}
            </div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>Last 30 days</div>
          </div>
          {stats.byModel.length > 0 && (
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
                {stats.byModel.reduce((s, r) => s + r.calls, 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>API calls (30d)</div>
            </div>
          )}
        </div>

        {/* By model (30d) */}
        {stats.byModel.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", marginBottom: 12 }}>
              By model - last 30 days
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Model", "Calls", "Prompt tokens", "Completion tokens", "Cost"].map(h => (
                    <th key={h} style={{ padding: "0 12px 8px", textAlign: h === "Cost" ? "right" : "left", fontSize: "0.57rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.byModel.map((row, i) => (
                  <tr key={row.model} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "11px 12px", fontSize: "0.80rem", fontFamily: "monospace", color: "var(--fg-muted)" }}>
                      {row.model.replace("anthropic/", "").replace("google/", "").replace("openai/", "")}
                      <span style={{ marginLeft: 6, fontSize: "0.62rem", color: "rgba(165,182,214,0.3)" }}>{row.model.split("/")[0]}</span>
                    </td>
                    <td style={{ padding: "11px 12px", fontSize: "0.80rem", color: "rgba(165,182,214,0.6)", fontVariantNumeric: "tabular-nums" }}>{row.calls.toLocaleString()}</td>
                    <td style={{ padding: "11px 12px", fontSize: "0.80rem", color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums" }}>{fmtTokens(row.promptTokens)}</td>
                    <td style={{ padding: "11px 12px", fontSize: "0.80rem", color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums" }}>{fmtTokens(row.completionTokens)}</td>
                    <td style={{ padding: "11px 12px", textAlign: "right", fontSize: "0.84rem", fontWeight: 700, color: "#ef4444", fontVariantNumeric: "tabular-nums" }}>{fmt(row.totalUsd, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Call log */}
        {stats.recentEntries.length > 0 && (
          <CallLog entries={stats.recentEntries} />
        )}

        {/* No data yet */}
        {!hasData && (
          <div style={{ marginBottom: 40, padding: "24px 0" }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.84rem", color: "rgba(165,182,214,0.35)" }}>No API calls tracked yet.</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "rgba(165,182,214,0.22)" }}>
              Costs are recorded automatically as you use Discovery, clustering, and content generation.
            </p>
          </div>
        )}

        {/* Price reference */}
        <div>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", marginBottom: 12 }}>
            Model pricing reference (per 1M tokens)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Model", "Input", "Output"].map(h => (
                  <th key={h} style={{ padding: "0 12px 8px", textAlign: "left", fontSize: "0.57rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)", borderBottom: "1px solid var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staticModels.map(([model, prices]) => (
                <tr key={model} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 12px", fontSize: "0.78rem", fontFamily: "monospace", color: "var(--fg-muted)" }}>
                    {model.split("/").pop()}
                    <span style={{ marginLeft: 6, fontSize: "0.62rem", color: "rgba(165,182,214,0.3)" }}>{model.split("/")[0]}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "0.78rem", color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums" }}>
                    ${prices.input.toFixed(3)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "0.78rem", color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums" }}>
                    ${prices.output.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: "16px 0 0", fontSize: "0.70rem", color: "rgba(165,182,214,0.25)" }}>
            Pricing sourced from OpenRouter model pages. Update <code style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>src/lib/cost-tracker.ts</code> if prices change.
          </p>
        </div>

      </div>
    </div>
  );
}
