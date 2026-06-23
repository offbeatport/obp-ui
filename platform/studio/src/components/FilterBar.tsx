import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/Button";

interface FilterState {
  sector: string;
  status: string;
  minScore: number;
  since: "6h" | "24h" | "7d" | "30d" | "90d" | "all";
  minPlatforms: 1 | 2 | 3;
  hasBrief: "all" | "yes" | "no";
  community: string[];
  sources: string[];
  minWtp: number;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  communities?: string[];
  availableSources?: string[];
}

const SAAS_SECTORS = ["all", "data", "ai", "fintech", "solopreneur", "freelancer", "future-of-work", "career-pivot", "investment"] as const;
const FINANCE_SECTORS = ["all", "portfolio-mgmt", "risk-analytics", "perf-attribution", "trading-infra", "wealth-mgmt", "compliance", "data-infra", "fund-ops"] as const;

const SAAS_SECTOR_LABELS: Record<string, string> = {
  all: "All sectors",
  data: "Data",
  ai: "AI",
  fintech: "Fintech",
  solopreneur: "Solopreneur",
  freelancer: "Freelancer",
  "future-of-work": "Future of Work",
  "career-pivot": "Career Pivot",
  investment: "Investment",
};

const FINANCE_SECTOR_LABELS: Record<string, string> = {
  all: "All sectors",
  "portfolio-mgmt": "Portfolio Mgmt",
  "risk-analytics": "Risk Analytics",
  "perf-attribution": "Perf Attribution",
  "trading-infra": "Trading Infra",
  "wealth-mgmt": "Wealth Mgmt",
  compliance: "Compliance",
  "data-infra": "Data Infra",
  "fund-ops": "Fund Ops",
};

export type { FilterState };

function MultiPicker({ selected, options, placeholder, onChange }: {
  selected: string[];
  options: string[];
  placeholder: string;
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (c: string) => {
    onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? selected[0].length > 18 ? selected[0].slice(0, 16) + "…" : selected[0]
    : `${selected.length} selected`;

  const btnStyle: React.CSSProperties = {
    background: "transparent",
    border: `1px solid ${selected.length > 0 ? "rgba(0,255,136,0.35)" : "var(--border)"}`,
    color: selected.length > 0 ? "var(--accent)" : "rgba(250,250,250,0.85)",
    padding: "4px 22px 4px 8px",
    fontSize: "0.82rem",
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
    letterSpacing: "0.02em",
    position: "relative",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='rgba(250,250,250,0.45)'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    WebkitAppearance: "none",
    appearance: "none",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        style={btnStyle}
      >
        {label}
      </Button>
      {open && (
        <div style={{
          position: "fixed",
          zIndex: 9999,
          background: "#111",
          border: "1px solid rgba(255,255,255,0.1)",
          minWidth: "200px",
          maxHeight: "280px",
          overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
        }}
          ref={(el) => {
            if (!el || !ref.current) return;
            const r = ref.current.getBoundingClientRect();
            el.style.top = `${r.bottom + 4}px`;
            el.style.left = `${r.left}px`;
          }}
        >
          {selected.length > 0 && (
            <div
              onClick={() => onChange([])}
              style={{
                padding: "7px 12px", fontSize: "0.76rem", color: "rgba(250,250,250,0.62)",
                cursor: "pointer", borderBottom: "1px solid var(--border)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              Clear selection
            </div>
          )}
          {options.map((c) => {
            const checked = selected.includes(c);
            return (
              <div
                key={c}
                onClick={() => toggle(c)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "7px 12px", cursor: "pointer", fontSize: "0.86rem",
                  color: checked ? "var(--fg)" : "rgba(250,250,250,0.80)",
                  background: checked ? "rgba(0,255,136,0.05)" : "transparent",
                }}
              >
                <span style={{
                  width: 10, height: 10, border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                  background: checked ? "var(--accent)" : "transparent", flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <span style={{ color: "#000", fontSize: "8px", fontWeight: 900 }}>✓</span>}
                </span>
                {c}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, onChange, communities = [], availableSources = [] }: Props) {
  const market = typeof window !== "undefined" ? (localStorage.getItem("market") ?? "saas") : "saas";
  const SECTORS = market === "finance" ? FINANCE_SECTORS : SAAS_SECTORS;
  const SECTOR_LABELS = market === "finance" ? FINANCE_SECTOR_LABELS : SAAS_SECTOR_LABELS;

  const sel: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "rgba(250,250,250,0.85)",
    padding: "4px 22px 4px 8px",
    fontSize: "0.82rem",
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='rgba(250,250,250,0.45)'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    outline: "none",
    letterSpacing: "0.02em",
  };

  const opt = { style: { background: "#111" } };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })} style={sel}>
        <option value="!pass" {...opt}>Hide passed</option>
        <option value="all" {...opt}>All statuses</option>
        <option value="new" {...opt}>New</option>
        <option value="interesting" {...opt}>Interesting</option>
        <option value="building" {...opt}>Building</option>
        <option value="pass" {...opt}>Pass</option>
      </select>

      <select value={filters.since} onChange={(e) => onChange({ ...filters, since: e.target.value as FilterState["since"] })} style={sel}>
        <option value="6h" {...opt}>Last 6 hours</option>
        <option value="24h" {...opt}>Last 24 hours</option>
        <option value="7d" {...opt}>Last 7 days</option>
        <option value="30d" {...opt}>Last 30 days</option>
        <option value="90d" {...opt}>Last 90 days</option>
        <option value="all" {...opt}>All time</option>
      </select>

      <select value={filters.sector} onChange={(e) => onChange({ ...filters, sector: e.target.value })} style={sel}>
        {SECTORS.map((s) => (
          <option key={s} value={s} {...opt}>{SECTOR_LABELS[s] ?? s}</option>
        ))}
      </select>

      <select value={filters.minPlatforms} onChange={(e) => onChange({ ...filters, minPlatforms: parseInt(e.target.value) as 1 | 2 | 3 })} style={sel}>
        <option value={1} {...opt}>Any source</option>
        <option value={2} {...opt}>2+ sources</option>
        <option value={3} {...opt}>3+ sources</option>
      </select>

      <select value={filters.minScore} onChange={(e) => onChange({ ...filters, minScore: parseFloat(e.target.value) })} style={sel}>
        <option value={0} {...opt}>Any score</option>
        <option value={4} {...opt}>Score 4+</option>
        <option value={5} {...opt}>Score 5+</option>
        <option value={6} {...opt}>Score 6+</option>
        <option value={7} {...opt}>Score 7+</option>
        <option value={8} {...opt}>Score 8+</option>
      </select>

      <select value={filters.hasBrief} onChange={(e) => onChange({ ...filters, hasBrief: e.target.value as FilterState["hasBrief"] })} style={sel}>
        <option value="all" {...opt}>Any brief</option>
        <option value="yes" {...opt}>Has brief</option>
        <option value="no" {...opt}>No brief</option>
      </select>

      {communities.length > 1 && (
        <MultiPicker
          selected={filters.community}
          options={communities}
          placeholder="All communities"
          onChange={(community) => onChange({ ...filters, community })}
        />
      )}

      {availableSources.length > 1 && (
        <MultiPicker
          selected={filters.sources}
          options={availableSources}
          placeholder="All sources"
          onChange={(sources) => onChange({ ...filters, sources })}
        />
      )}

      <select value={filters.minWtp} onChange={(e) => onChange({ ...filters, minWtp: parseFloat(e.target.value) })} style={sel}>
        <option value={0} {...opt}>Any WTP</option>
        <option value={5} {...opt}>WTP 5+</option>
        <option value={6} {...opt}>WTP 6+</option>
        <option value={7} {...opt}>WTP 7+</option>
        <option value={8} {...opt}>WTP 8+</option>
      </select>
    </div>
  );
}
