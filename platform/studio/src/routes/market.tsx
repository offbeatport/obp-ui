import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getMarketProducts } from "~/lib/server-fns";
import type { MarketProduct } from "~/lib/server-fns";
import { RefreshCw, ExternalLink, Search, X, Users, Zap } from "lucide-react";
import { Button } from "~/components/ui/Button";

export const Route = createFileRoute("/market")({
  component: MarketPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  ph: { label: "Product Hunt", fg: "#cc4d29", border: "rgba(204,77,41,0.3)" },
  ih: { label: "Indie Hackers", fg: "#4f46e5", border: "rgba(79,70,229,0.3)" },
};

const TEAM_CONFIG: Record<MarketProduct["teamSize"], { label: string; color: string }> = {
  solo: { label: "Solo", color: "var(--success)" },
  small: { label: "1–9", color: "#f59e0b" },
  medium: { label: "10+", color: "var(--fg-dim)" },
  large: { label: "50+", color: "var(--fg-dim)" },
  unknown: { label: "?", color: "var(--fg-faint)" },
};

const FUND_CONFIG: Record<MarketProduct["funding"], { label: string; color: string }> = {
  bootstrapped: { label: "Bootstrapped", color: "var(--success)" },
  vc: { label: "VC-backed", color: "rgba(239,68,68,0.7)" },
  other: { label: "Other", color: "var(--fg-dim)" },
  unknown: { label: "-", color: "var(--fg-faint)" },
};

const MRR_RANGES = [
  { key: "all", label: "All MRR" },
  { key: "sweet", label: "$1k–$50k", min: 1_000, max: 50_000 },
  { key: "small", label: "$1k–$10k", min: 1_000, max: 10_000 },
  { key: "mid", label: "$10k–$50k", min: 10_000, max: 50_000 },
  { key: "large", label: "$50k+", min: 50_000, max: Infinity },
] as const;
type MrrRangeKey = typeof MRR_RANGES[number]["key"];

function fmtMrr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ProductRow({ p }: { p: MarketProduct }) {
  const src = SOURCE_CONFIG[p.source];
  const team = TEAM_CONFIG[p.teamSize];
  const fund = FUND_CONFIG[p.funding];

  return (
    <a href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div
        className="market-product-row"
        style={{
          display: "grid",
          gridTemplateColumns: "36px minmax(0,1fr) 100px 90px 80px 110px 90px 28px",
          alignItems: "center",
          gap: 12,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border)",
          background: "transparent",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
      >
        {/* Logo */}
        <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", background: "rgba(100,130,180,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {p.logoUrl ? (
            <img src={p.logoUrl} alt="" width={32} height={32} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span style={{ fontSize: "0.84rem", color: "var(--fg-dim)" }}>{p.name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Name + tagline */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </span>
            {p.cloneViable && (
              <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--success)", border: "1px solid rgba(34,197,94,0.3)", padding: "1px 5px", borderRadius: 3, flexShrink: 0, whiteSpace: "nowrap" }}>
                Clone target
              </span>
            )}
            {p.tags.slice(0, 2).map(t => (
              <span key={t} style={{ fontSize: "0.60rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-dim)", background: "rgba(100,130,180,0.07)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, flexShrink: 0, whiteSpace: "nowrap" }}>
                {t}
              </span>
            ))}
          </div>
          <span style={{ fontSize: "0.76rem", color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {p.tagline}
          </span>
        </div>

        {/* MRR */}
        <div>
          {p.mrr != null ? (
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
              {fmtMrr(p.mrr)}
              <span style={{ fontSize: "0.64rem", fontWeight: 400, color: "var(--fg-dim)", marginLeft: 2 }}>MRR</span>
            </span>
          ) : (
            <span style={{ fontSize: "0.76rem", color: "var(--fg-faint)" }}>-</span>
          )}
        </div>

        {/* Team size */}
        <div>
          <span style={{ fontSize: "0.76rem", fontWeight: 600, color: team.color }}>
            {team.label}
          </span>
        </div>

        {/* Funding */}
        <div>
          <span style={{ fontSize: "0.72rem", color: fund.color }}>
            {fund.label}
          </span>
        </div>

        {/* Traction (votes / MRR label) */}
        <div>
          <span style={{ fontSize: "0.76rem", color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
            {p.tractionLabel}
          </span>
        </div>

        {/* Source */}
        <div>
          <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: src.fg, border: `1px solid ${src.border}`, padding: "2px 5px", borderRadius: 3, whiteSpace: "nowrap" }}>
            {src.label}
          </span>
        </div>

        {/* Arrow */}
        <ExternalLink size={11} className="market-ext-icon" style={{ color: "var(--fg-faint)", flexShrink: 0, transition: "color 0.1s" }} />
      </div>
    </a>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "ph" | "ih">("ih");
  const [mrrRange, setMrrRange] = useState<MrrRangeKey>("sweet");
  const [soloOnly, setSoloOnly] = useState(true);
  const [bootstrappedOnly, setBootstrappedOnly] = useState(true);
  const [cloneOnly, setCloneOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getMarketProducts()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let out = products;
    if (sourceFilter !== "all") out = out.filter(p => p.source === sourceFilter);

    const range = MRR_RANGES.find(r => r.key === mrrRange);
    if (range && range.key !== "all") {
      out = out.filter(p => p.mrr != null && p.mrr >= (range as any).min && p.mrr < (range as any).max);
    }

    if (soloOnly) out = out.filter(p => p.teamSize === "solo" || p.teamSize === "small" || p.teamSize === "unknown");
    if (bootstrappedOnly) out = out.filter(p => p.funding === "bootstrapped" || p.funding === "unknown");
    if (cloneOnly) out = out.filter(p => p.cloneViable);

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return out;
  }, [products, sourceFilter, mrrRange, soloOnly, bootstrappedOnly, cloneOnly, search]);

  const counts = useMemo(() => ({
    all: products.length,
    ih: products.filter(p => p.source === "ih").length,
    ph: products.filter(p => p.source === "ph").length,
    clone: products.filter(p => p.cloneViable).length,
  }), [products]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Clone Candidates</h1>
          <span style={{ fontSize: "0.78rem", color: "var(--fg-subtle)" }}>
            Proven products a solopreneur can replicate
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            style={{ marginLeft: "auto", gap: 4, color: "var(--fg-subtle)" }}
          >
            <RefreshCw size={11} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {/* Filters row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>

          {/* Source */}
          {(["all", "ih", "ph"] as const).map(s => {
            const active = sourceFilter === s;
            const src = s === "all" ? null : SOURCE_CONFIG[s];
            return (
              <button key={s} onClick={() => setSourceFilter(s)}
                style={{
                  padding: "3px 9px", borderRadius: 4, border: "1px solid", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                  borderColor: active ? (src?.fg ?? "var(--accent)") : "var(--border-strong)",
                  background: active ? `${src?.fg ?? "var(--accent)"}18` : "transparent",
                  color: active ? (src?.fg ?? "var(--accent)") : "var(--fg-subtle)",
                }}
              >
                {s === "all" ? `All ${counts.all}` : s === "ih" ? `Indie Hackers ${counts.ih}` : `Product Hunt ${counts.ph}`}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />

          {/* MRR range */}
          {MRR_RANGES.map(r => (
            <button key={r.key} onClick={() => setMrrRange(r.key)}
              style={{
                padding: "3px 9px", borderRadius: 4, border: "1px solid", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                borderColor: mrrRange === r.key ? "var(--accent)" : "var(--border-strong)",
                background: mrrRange === r.key ? "rgba(96,165,250,0.1)" : "transparent",
                color: mrrRange === r.key ? "var(--accent)" : "var(--fg-subtle)",
              }}
            >
              {r.label}
            </button>
          ))}

          <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />

          {/* Solo/small team toggle */}
          <Button
            variant={soloOnly ? "outline" : "ghost"}
            size="sm"
            onClick={() => setSoloOnly(v => !v)}
            style={{
              gap: 4,
              borderColor: soloOnly ? "var(--success)" : "var(--border-strong)",
              background: soloOnly ? "rgba(34,197,94,0.08)" : "transparent",
              color: soloOnly ? "var(--success)" : "var(--fg-subtle)",
            }}
          >
            <Users size={10} />
            Solo / Small
          </Button>

          {/* Bootstrapped toggle */}
          <Button
            variant={bootstrappedOnly ? "outline" : "ghost"}
            size="sm"
            onClick={() => setBootstrappedOnly(v => !v)}
            style={{
              borderColor: bootstrappedOnly ? "var(--success)" : "var(--border-strong)",
              background: bootstrappedOnly ? "rgba(34,197,94,0.08)" : "transparent",
              color: bootstrappedOnly ? "var(--success)" : "var(--fg-subtle)",
            }}
          >
            Bootstrapped
          </Button>

          {/* Clone targets only */}
          <Button
            variant={cloneOnly ? "outline" : "ghost"}
            size="sm"
            onClick={() => setCloneOnly(v => !v)}
            style={{
              gap: 4,
              borderColor: cloneOnly ? "var(--accent)" : "var(--border-strong)",
              background: cloneOnly ? "rgba(96,165,250,0.1)" : "transparent",
              color: cloneOnly ? "var(--accent)" : "var(--fg-subtle)",
            }}
          >
            <Zap size={10} />
            Clone targets only <span style={{ opacity: 0.6 }}>{counts.clone}</span>
          </Button>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 160, maxWidth: 280, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0 7px" }}>
            <Search size={10} style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ background: "none", border: "none", outline: "none", fontSize: "0.74rem", color: "var(--fg)", width: "100%", fontFamily: "inherit", height: 24 }} />
            {search && <Button variant="ghost" size="sm" onClick={() => setSearch("")} style={{ padding: 0, height: "auto", color: "var(--fg-subtle)" }}><X size={9} /></Button>}
          </div>

          <span style={{ fontSize: "0.70rem", color: "var(--fg-subtle)", marginLeft: "auto" }}>
            {filtered.length.toLocaleString()} shown
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "36px minmax(0,1fr) 100px 90px 80px 110px 90px 28px",
          gap: 12, padding: "0 18px 7px",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-subtle)",
        }}>
          <span />
          <span>Product</span>
          <span>MRR</span>
          <span>Team</span>
          <span>Funding</span>
          <span>Traction</span>
          <span>Source</span>
          <span />
        </div>
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading && products.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>
            <RefreshCw size={15} style={{ animation: "spin 0.8s linear infinite", display: "block", margin: "0 auto 10px" }} />
            Fetching from Indie Hackers and Product Hunt…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>
            {products.length === 0 ? "No data - click Refresh." : "No products match your filters."}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map(vItem => (
              <div key={filtered[vItem.index].id} data-index={vItem.index} ref={virtualizer.measureElement}
                style={{ position: "absolute", top: vItem.start, left: 0, right: 0 }}>
                <ProductRow p={filtered[vItem.index]} />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
