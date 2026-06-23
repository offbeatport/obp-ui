import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./Button";

// ── Shared filter state ───────────────────────────────────────────────────────

export interface OppFilterState {
  showPassed: boolean;
  scoreMin: number | null;
  shipScoreMin: number | null;
  sectors: Set<string>;
  hasBrief: boolean | null;
  signalMin: number | null;
  platforms: Set<string>;
  wtpCountMin: number | null;
}

export const EMPTY_OPP_FILTERS: OppFilterState = {
  showPassed: false,
  scoreMin: null,
  shipScoreMin: null,
  sectors: new Set(),
  hasBrief: null,
  signalMin: null,
  platforms: new Set(),
  wtpCountMin: null,
};

export function isOppFiltersEmpty(f: OppFilterState) {
  return (
    !f.showPassed &&
    f.scoreMin === null &&
    f.shipScoreMin === null &&
    f.sectors.size === 0 &&
    f.hasBrief === null &&
    f.signalMin === null &&
    f.platforms.size === 0 &&
    f.wtpCountMin === null
  );
}

// ── Design primitives ─────────────────────────────────────────────────────────

const LABEL_STYLE = {
  fontSize: "0.60rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "rgba(165,182,214,0.38)",
  marginBottom: 10,
};

const DIVIDER = (
  <div style={{ height: 1, background: "rgba(165,182,214,0.07)" }} />
);

const PLATFORM_FG: Record<string, string> = {
  reddit: "#ff6314", hn: "#e17b3c", g2: "#3b82f6",
  github: "#a78bfa", stackoverflow: "#f59e0b", devto: "#a78bfa",
};

function chip(on: boolean, fg = "var(--accent)"): React.CSSProperties {
  const isAccent = fg === "var(--accent)";
  return {
    display: "inline-flex", alignItems: "center",
    padding: "4px 11px", borderRadius: 3,
    cursor: "pointer", fontFamily: "inherit",
    fontSize: "0.75rem", fontWeight: on ? 600 : 400,
    border: `1px solid ${on
      ? isAccent ? "rgba(0,255,136,0.35)" : fg + "55"
      : "rgba(165,182,214,0.1)"}`,
    background: on
      ? isAccent ? "rgba(0,255,136,0.07)" : fg + "14"
      : "transparent",
    color: on ? (isAccent ? "var(--accent)" : fg) : "rgba(165,182,214,0.45)",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  };
}

function NumInput({ label, value, onChange, max = 10 }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  const active = value !== null;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>{label}</div>
      <input
        type="number"
        min={1}
        max={max}
        className="fp-num"
        value={value ?? ""}
        placeholder="-"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(isNaN(n) || n < 1 ? null : Math.min(n, max));
        }}
        style={{
          width: "100%", boxSizing: "border-box",
          background: active ? "rgba(0,255,136,0.04)" : "rgba(165,182,214,0.03)",
          border: `1px solid ${active ? "rgba(0,255,136,0.28)" : "rgba(165,182,214,0.1)"}`,
          color: active ? "var(--accent)" : "rgba(165,182,214,0.3)",
          padding: "5px 6px",
          fontSize: "0.86rem", fontWeight: active ? 600 : 400,
          outline: "none", fontFamily: "inherit",
          fontVariantNumeric: "tabular-nums", textAlign: "center",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.45)"; e.currentTarget.style.color = "var(--accent)"; }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = active ? "rgba(0,255,136,0.28)" : "rgba(165,182,214,0.1)";
          e.currentTarget.style.color = active ? "var(--accent)" : "rgba(165,182,214,0.3)";
        }}
      />
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

export function FilterPanel<F extends OppFilterState>({
  filters,
  onChange,
  emptyFilters,
  isEmpty,
  availableSectors,
  availablePlatforms,
  availableProjects,
  selectedProjects,
  onProjectToggle,
  align = "right",
}: {
  filters: F;
  onChange: (next: F) => void;
  emptyFilters: F;
  isEmpty: (f: F) => boolean;
  availableSectors: string[];
  availablePlatforms: string[];
  availableProjects?: { id: string; name: string }[];
  selectedProjects?: Set<string>;
  onProjectToggle?: (id: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = [
    filters.showPassed,
    filters.scoreMin !== null,
    filters.shipScoreMin !== null,
    filters.sectors.size > 0,
    filters.hasBrief !== null,
    filters.signalMin !== null,
    filters.platforms.size > 0,
    filters.wtpCountMin !== null,
    (selectedProjects?.size ?? 0) > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleSector(s: string) {
    const n = new Set(filters.sectors);
    n.has(s) ? n.delete(s) : n.add(s);
    onChange({ ...filters, sectors: n });
  }
  function togglePlatform(p: string) {
    const n = new Set(filters.platforms);
    n.has(p) ? n.delete(p) : n.add(p);
    onChange({ ...filters, platforms: n });
  }

  const isActive = open || activeCount > 0;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 11px",
          background: isActive ? "rgba(0,255,136,0.06)" : "transparent",
          border: `1px solid ${isActive ? "rgba(0,255,136,0.35)" : "var(--border)"}`,
          color: isActive ? "var(--accent)" : "rgba(250,250,250,0.52)",
          fontSize: "0.74rem", fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
          borderRadius: "var(--radius)",
        }}
      >
        <SlidersHorizontal size={11} />
        Filter
        {activeCount > 0 && (
          <span style={{
            minWidth: 16, height: 15, padding: "0 4px",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,255,136,0.15)", color: "var(--accent)",
            fontSize: "0.66rem", fontWeight: 700, borderRadius: 2,
          }}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute", ...(align === "left" ? { left: 0 } : { right: 0 }), top: "calc(100% + 6px)",
            width: 320, zIndex: 200,
            background: "#0c0c0f",
            border: "1px solid rgba(165,182,214,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.9)",
            maxHeight: "calc(100vh - 120px)", overflowY: "auto",
          }}
        >
          <style>{`
            .fp-num::-webkit-inner-spin-button,
            .fp-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .fp-num { -moz-appearance: textfield; }
            .fp-chip:hover { border-color: rgba(0,255,136,0.3) !important; color: rgba(250,250,250,0.75) !important; }
          `}</style>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid rgba(165,182,214,0.07)",
            position: "sticky", top: 0, background: "#0c0c0f", zIndex: 1,
          }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(165,182,214,0.45)" }}>
              Filters
            </span>
            {!isEmpty(filters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(emptyFilters)}
                className="fp-reset"
                style={{ padding: 0, fontSize: "0.76rem" }}
              >
                Reset all
              </Button>
            )}
          </div>

          {/* Show archived */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px" }}>
            <span style={{ fontSize: "0.82rem", color: "rgba(165,182,214,0.55)" }}>Show archived</span>
            <Button
              variant={filters.showPassed ? "destructive" : "outline"}
              size="sm"
              onClick={() => onChange({ ...filters, showPassed: !filters.showPassed })}
            >
              {filters.showPassed ? "showing" : "hidden"}
            </Button>
          </div>

          {DIVIDER}

          {/* Scores */}
          <div style={{ padding: "12px 16px" }}>
            <div style={LABEL_STYLE}>Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <NumInput label="Score ≥" value={filters.scoreMin} onChange={(v) => onChange({ ...filters, scoreMin: v })} />
              <NumInput label="Ship ≥" value={filters.shipScoreMin} onChange={(v) => onChange({ ...filters, shipScoreMin: v })} />
              <NumInput label="Signals ≥" value={filters.signalMin} onChange={(v) => onChange({ ...filters, signalMin: v })} max={999} />
              <NumInput label="WTP ≥" value={filters.wtpCountMin} onChange={(v) => onChange({ ...filters, wtpCountMin: v })} max={99} />
            </div>
          </div>

          {DIVIDER}

          {/* Brief */}
          <div style={{ padding: "12px 16px" }}>
            <div style={LABEL_STYLE}>Brief</div>
            <div style={{ display: "flex", gap: 5 }}>
              {([null, true, false] as const).map((v) => {
                const label = v === null ? "Any" : v ? "Has brief" : "No brief";
                const on = filters.hasBrief === v;
                return (
                  <button
                    key={String(v)}
                    className="fp-chip"
                    onClick={() => onChange({ ...filters, hasBrief: on ? null : v })}
                    style={chip(on)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector */}
          {availableSectors.length > 0 && (
            <>
              {DIVIDER}
              <div style={{ padding: "12px 16px" }}>
                <div style={LABEL_STYLE}>Sector</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {availableSectors.map((s) => {
                    const on = filters.sectors.has(s);
                    return (
                      <button key={s} className="fp-chip" onClick={() => toggleSector(s)}
                        style={{ ...chip(on), textTransform: "uppercase", fontSize: "0.70rem", letterSpacing: "0.06em" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Sources */}
          {availablePlatforms.length > 0 && (
            <>
              {DIVIDER}
              <div style={{ padding: "12px 16px" }}>
                <div style={LABEL_STYLE}>Sources</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {availablePlatforms.map((p) => {
                    const on = filters.platforms.has(p);
                    const fg = PLATFORM_FG[p] ?? "rgba(165,182,214,0.6)";
                    return (
                      <button key={p} onClick={() => togglePlatform(p)}
                        style={{ ...chip(on, fg), textTransform: "uppercase", fontSize: "0.70rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Projects (global page only) */}
          {availableProjects && availableProjects.length > 0 && onProjectToggle && selectedProjects && (
            <>
              {DIVIDER}
              <div style={{ padding: "12px 16px 16px" }}>
                <div style={LABEL_STYLE}>Project</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {availableProjects.map(({ id, name }) => {
                    const on = selectedProjects.has(id);
                    return (
                      <button key={id} className="fp-chip" onClick={() => onProjectToggle(id)} style={chip(on)}>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {availableSectors.length === 0 && availablePlatforms.length === 0 && !availableProjects?.length && (
            <div style={{ height: 8 }} />
          )}
        </div>
      )}
    </div>
  );
}
