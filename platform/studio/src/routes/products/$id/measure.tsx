import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { TrendingUp, TrendingDown, Plus, Trash2, X } from "lucide-react";
import {
  getMonitorData,
  saveMrrSnapshot,
  saveCacEntry,
  deleteCacEntry,
  saveTrafficSnapshot,
} from "~/lib/build-fns";
import type { MonitorData } from "~/lib/build-fns";
import { SectionLabel } from "../$id";
import { Button } from "~/components/ui/Button";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/products/$id/measure")({
  loader: async ({ params }) => {
    const productId = parseInt(params.id, 10);
    const monitor = productId
      ? await getMonitorData({ data: { productId } })
      : { mrrSnapshots: [], cacEntries: [], trafficSnapshots: [] };
    return { ...monitor, productId };
  },
  staleTime: 0,
  pendingMs: 0,
  pendingComponent: () => null,
  component: MonitorPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const CAC_CHANNELS = [
  { key: "reddit", label: "Reddit" },
  { key: "hn", label: "Hacker News" },
  { key: "ph", label: "Product Hunt" },
  { key: "twitter", label: "Twitter / X" },
  { key: "bluesky", label: "Bluesky" },
  { key: "seo", label: "SEO" },
  { key: "content", label: "Content" },
  { key: "email", label: "Email" },
  { key: "other", label: "Other" },
] as const;

const TRAFFIC_SOURCES = [
  { key: "organic", label: "Organic Search" },
  { key: "direct", label: "Direct" },
  { key: "reddit", label: "Reddit" },
  { key: "hn", label: "Hacker News" },
  { key: "twitter", label: "Twitter / X" },
  { key: "ph", label: "Product Hunt" },
  { key: "referral", label: "Referral" },
  { key: "other", label: "Other" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMrr(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function momChange(snapshots: MonitorData["mrrSnapshots"]): number | null {
  if (snapshots.length < 2) return null;
  const current = snapshots[0].mrrCents;
  const previous = snapshots[1].mrrCents;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function computeSparkline(snapshots: MonitorData["mrrSnapshots"]): number[] {
  const vals = snapshots.slice(0, 12).map(s => s.mrrCents).reverse();
  if (vals.length < 2) return vals;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return vals.map(() => 0.5);
  return vals.map(v => (v - min) / (max - min));
}

function fmtCac(spendCents: number, conversions: number): string {
  if (conversions === 0) return "-";
  const cac = spendCents / conversions / 100;
  return `$${cac.toFixed(0)}`;
}

function channelLabel(key: string): string {
  return CAC_CHANNELS.find(c => c.key === key)?.label ?? key;
}

function trafficLabel(key: string): string {
  return TRAFFIC_SOURCES.find(s => s.key === key)?.label ?? key;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - v * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline
        points={polyline}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ── Shared: small inline form field ──────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[4px]">
      <span
        className="text-[0.60rem] font-bold tracking-widest uppercase"
        style={{ color: "rgba(165,182,214,0.45)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(165,182,214,0.05)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--fg)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.78rem",
  padding: "5px 8px",
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};


// ── MRR Section ───────────────────────────────────────────────────────────────

function MrrSection({
  snapshots,
  productId,
  onSaved,
}: {
  snapshots: MonitorData["mrrSnapshots"];
  productId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mrr, setMrr] = useState("");
  const [saving, startSave] = useTransition();

  const current = snapshots[0] ?? null;
  const mom = momChange(snapshots);
  const sparkValues = computeSparkline(snapshots);

  function handleSave() {
    const dollars = parseFloat(mrr);
    if (isNaN(dollars) || dollars < 0) return;
    const cents = Math.round(dollars * 100);
    startSave(async () => {
      await saveMrrSnapshot({ data: { productId, mrrCents: cents } });
      setMrr("");
      setOpen(false);
      onSaved();
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px", marginBottom: "24px" }}>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>MRR</SectionLabel>
        <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>
          {open ? <X size={11} /> : <Plus size={11} />}
          {open ? "cancel" : "Add snapshot"}
        </Button>
      </div>

      {/* Current MRR hero */}
      <div className="flex items-end gap-6 mb-4">
        <div>
          <div
            className="text-[2.8rem] font-light leading-none tracking-tight [font-variant-numeric:tabular-nums]"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--fg)" }}
          >
            {current ? fmtMrr(current.mrrCents) : "-"}
          </div>
          <div className="flex items-center gap-2 mt-[6px]">
            {mom !== null && (
              <span
                className="text-[0.72rem] font-semibold flex items-center gap-[3px]"
                style={{ color: mom >= 0 ? "#22c55e" : "#ef4444" }}
              >
                {mom >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {mom >= 0 ? "+" : ""}{mom.toFixed(1)}% MoM
              </span>
            )}
            {current && (
              <span className="text-[0.68rem]" style={{ color: "rgba(165,182,214,0.35)" }}>
                as of {fmtDate(current.createdAt)}
              </span>
            )}
          </div>
        </div>
        {sparkValues.length >= 2 && (
          <div style={{ opacity: 0.7 }}>
            <Sparkline values={sparkValues} />
          </div>
        )}
      </div>

      {/* Inline add form */}
      {open && (
        <div
          className="flex items-end gap-3 mt-3 p-3 rounded"
          style={{ background: "rgba(165,182,214,0.03)", border: "1px solid var(--border)" }}
        >
          <div style={{ width: 160 }}>
            <FieldRow label="MRR (USD)">
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1200"
                value={mrr}
                onChange={e => setMrr(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </FieldRow>
          </div>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "saving…" : "Save"}
          </Button>
        </div>
      )}

      {/* History list */}
      {snapshots.length > 0 && (
        <div className="mt-4">
          <div
            className="grid px-3 py-[5px] rounded-t"
            style={{
              gridTemplateColumns: "1fr 1fr 100px",
              background: "rgba(165,182,214,0.03)",
              borderTop: "1px solid var(--border)",
              borderLeft: "1px solid var(--border)",
              borderRight: "1px solid var(--border)",
            }}
          >
            {["Date", "MRR", "Change"].map(h => (
              <span
                key={h}
                className="text-[0.60rem] font-bold tracking-widest uppercase"
                style={{ color: "rgba(165,182,214,0.3)" }}
              >
                {h}
              </span>
            ))}
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderTop: "none",
              borderRadius: "0 0 var(--radius) var(--radius)",
              overflow: "hidden",
            }}
          >
            {snapshots.slice(0, 12).map((snap, i) => {
              const prev = snapshots[i + 1];
              const change = prev
                ? prev.mrrCents === 0
                  ? null
                  : ((snap.mrrCents - prev.mrrCents) / prev.mrrCents) * 100
                : null;
              return (
                <div
                  key={snap.id}
                  className="grid px-3 py-[7px] items-center"
                  style={{
                    gridTemplateColumns: "1fr 1fr 100px",
                    borderBottom: i < Math.min(snapshots.length - 1, 11) ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span className="text-[0.72rem]" style={{ color: "rgba(165,182,214,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDate(snap.createdAt)}
                  </span>
                  <span className="text-[0.78rem] font-medium [font-variant-numeric:tabular-nums]" style={{ color: "var(--fg)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    {fmtMrr(snap.mrrCents)}
                  </span>
                  <span
                    className="text-[0.70rem] font-semibold [font-variant-numeric:tabular-nums]"
                    style={{
                      color: change === null ? "rgba(165,182,214,0.3)" : change >= 0 ? "#22c55e" : "#ef4444",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {change === null ? "-" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {snapshots.length === 0 && !open && (
        <p className="text-[0.78rem]" style={{ color: "rgba(165,182,214,0.3)" }}>
          No MRR recorded yet. Add your first snapshot above.
        </p>
      )}
    </div>
  );
}

// ── CAC Section ───────────────────────────────────────────────────────────────

function CacSection({
  entries,
  productId,
  onSaved,
}: {
  entries: MonitorData["cacEntries"];
  productId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string>(CAC_CHANNELS[0].key);
  const [spend, setSpend] = useState("");
  const [conversions, setConversions] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, startSave] = useTransition();

  function handleSave() {
    const spendDollars = parseFloat(spend);
    const conv = parseInt(conversions, 10);
    if (isNaN(spendDollars) || isNaN(conv) || conv < 0) return;
    const spendCents = Math.round(spendDollars * 100);
    startSave(async () => {
      await saveCacEntry({ data: { productId, channel, spendCents, conversions: conv } });
      setSpend("");
      setConversions("");
      setOpen(false);
      onSaved();
    });
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    await deleteCacEntry({ data: { id } });
    setDeleting(null);
    onSaved();
  }

  // Find most efficient channel (lowest CAC, must have conversions > 0)
  const withCac = entries
    .filter(e => e.conversions > 0)
    .map(e => ({ ...e, cacCents: e.spendCents / e.conversions }));
  const best = withCac.length > 0
    ? withCac.reduce((a, b) => a.cacCents < b.cacCents ? a : b)
    : null;

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px", marginBottom: "24px" }}>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>CAC per Channel</SectionLabel>
        <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>
          {open ? <X size={11} /> : <Plus size={11} />}
          {open ? "cancel" : "Add entry"}
        </Button>
      </div>

      {best && (
        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-[6px] rounded"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
        >
          <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: "#22c55e" }} />
          <span className="text-[0.70rem]" style={{ color: "rgba(165,182,214,0.6)" }}>
            Most efficient:
          </span>
          <span className="text-[0.72rem] font-semibold" style={{ color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
            {channelLabel(best.channel)}
          </span>
          <span className="text-[0.70rem]" style={{ color: "rgba(165,182,214,0.4)" }}>
            @ {fmtCac(best.spendCents, best.conversions)} / conversion
          </span>
        </div>
      )}

      {/* Inline add form */}
      {open && (
        <div
          className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded"
          style={{ background: "rgba(165,182,214,0.03)", border: "1px solid var(--border)" }}
        >
          <div style={{ width: 160 }}>
            <FieldRow label="Channel">
              <select
                style={selectStyle}
                value={channel}
                onChange={e => setChannel(e.target.value)}
              >
                {CAC_CHANNELS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </FieldRow>
          </div>
          <div style={{ width: 130 }}>
            <FieldRow label="Spend (USD)">
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 200"
                value={spend}
                onChange={e => setSpend(e.target.value)}
              />
            </FieldRow>
          </div>
          <div style={{ width: 130 }}>
            <FieldRow label="Conversions">
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="1"
                placeholder="# paying users"
                value={conversions}
                onChange={e => setConversions(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </FieldRow>
          </div>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "saving…" : "Save"}
          </Button>
        </div>
      )}

      {/* Table */}
      {entries.length > 0 ? (
        <div>
          <div
            className="grid px-3 py-[5px] rounded-t"
            style={{
              gridTemplateColumns: "1fr 80px 90px 90px 32px",
              background: "rgba(165,182,214,0.03)",
              borderTop: "1px solid var(--border)",
              borderLeft: "1px solid var(--border)",
              borderRight: "1px solid var(--border)",
            }}
          >
            {["Channel", "Spend", "Conv.", "CAC", ""].map((h, i) => (
              <span
                key={i}
                className="text-[0.60rem] font-bold tracking-widest uppercase"
                style={{ color: "rgba(165,182,214,0.3)" }}
              >
                {h}
              </span>
            ))}
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderTop: "none",
              borderRadius: "0 0 var(--radius) var(--radius)",
              overflow: "hidden",
            }}
          >
            {entries.map((entry, i) => {
              const isBest = best?.id === entry.id;
              return (
                <div
                  key={entry.id}
                  className="grid px-3 py-[7px] items-center"
                  style={{
                    gridTemplateColumns: "1fr 80px 90px 90px 32px",
                    borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none",
                    background: isBest ? "rgba(34,197,94,0.03)" : "transparent",
                  }}
                >
                  <span className="text-[0.75rem]" style={{ color: "var(--fg-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {channelLabel(entry.channel)}
                    {isBest && (
                      <span
                        className="ml-[6px] text-[0.58rem] font-bold tracking-widest uppercase px-[4px] py-[1px] rounded"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                      >
                        best
                      </span>
                    )}
                  </span>
                  <span className="text-[0.72rem] [font-variant-numeric:tabular-nums]" style={{ color: "rgba(165,182,214,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
                    ${(entry.spendCents / 100).toFixed(0)}
                  </span>
                  <span className="text-[0.72rem] [font-variant-numeric:tabular-nums]" style={{ color: "rgba(165,182,214,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.conversions}
                  </span>
                  <span
                    className="text-[0.78rem] font-semibold [font-variant-numeric:tabular-nums]"
                    style={{
                      color: entry.conversions === 0
                        ? "rgba(165,182,214,0.25)"
                        : isBest
                          ? "#22c55e"
                          : "var(--fg)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {fmtCac(entry.spendCents, entry.conversions)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                    title="Delete"
                    style={{ color: "rgba(165,182,214,0.2)", padding: 0, width: 24, height: 24 }}
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !open && (
          <p className="text-[0.78rem]" style={{ color: "rgba(165,182,214,0.3)" }}>
            No CAC entries yet. Track spend and conversions per channel above.
          </p>
        )
      )}
    </div>
  );
}

// ── Traffic Section ───────────────────────────────────────────────────────────

function TrafficSection({
  snapshots,
  productId,
  onSaved,
}: {
  snapshots: MonitorData["trafficSnapshots"];
  productId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();

  const latestSnapshot = snapshots[0] ?? null;
  const sourcesJson = latestSnapshot?.sourcesJson ?? {};
  const totalVisits = Object.values(sourcesJson).reduce((s, n) => s + n, 0);

  function handleSave() {
    const sourcesNum: Record<string, number> = {};
    let anyValue = false;
    for (const src of TRAFFIC_SOURCES) {
      const v = parseInt(visits[src.key] ?? "0", 10);
      if (!isNaN(v) && v > 0) {
        sourcesNum[src.key] = v;
        anyValue = true;
      }
    }
    if (!anyValue) return;
    startSave(async () => {
      await saveTrafficSnapshot({ data: { productId, sourcesJson: sourcesNum } });
      setVisits({});
      setOpen(false);
      onSaved();
    });
  }

  const ACCENT_COLORS = [
    "var(--accent)",
    "#a78bfa",
    "#34d399",
    "#f59e0b",
    "#f87171",
    "#38bdf8",
    "#fb923c",
    "rgba(165,182,214,0.5)",
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Traffic Sources</SectionLabel>
        <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>
          {open ? <X size={11} /> : <Plus size={11} />}
          {open ? "cancel" : "Update traffic"}
        </Button>
      </div>

      {/* Inline add form */}
      {open && (
        <div
          className="p-3 rounded mb-4"
          style={{ background: "rgba(165,182,214,0.03)", border: "1px solid var(--border)" }}
        >
          <div className="grid gap-x-4 gap-y-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {TRAFFIC_SOURCES.map(src => (
              <FieldRow key={src.key} label={src.label}>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="monthly visits"
                  value={visits[src.key] ?? ""}
                  onChange={e => setVisits(v => ({ ...v, [src.key]: e.target.value }))}
                />
              </FieldRow>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "saving…" : "Save snapshot"}
            </Button>
          </div>
        </div>
      )}

      {/* Bar chart of latest snapshot */}
      {latestSnapshot ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[0.68rem]" style={{ color: "rgba(165,182,214,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtDate(latestSnapshot.createdAt)} - {totalVisits.toLocaleString()} total visits
            </span>
          </div>
          <div className="flex flex-col gap-[6px]">
            {TRAFFIC_SOURCES
              .map((src, idx) => ({ src, idx, visits: sourcesJson[src.key] ?? 0 }))
              .filter(row => row.visits > 0)
              .sort((a, b) => b.visits - a.visits)
              .map(({ src, idx, visits: v }) => {
                const pct = totalVisits > 0 ? (v / totalVisits) * 100 : 0;
                const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                return (
                  <div key={src.key} className="flex items-center gap-3">
                    <span
                      className="text-[0.68rem] flex-shrink-0"
                      style={{ color: "rgba(165,182,214,0.45)", width: 110, fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {src.label}
                    </span>
                    <div className="flex-1 h-[6px] rounded-full" style={{ background: "rgba(165,182,214,0.07)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color, transition: "width 0.3s ease" }}
                      />
                    </div>
                    <span
                      className="text-[0.68rem] flex-shrink-0 [font-variant-numeric:tabular-nums]"
                      style={{ color: "rgba(165,182,214,0.45)", width: 50, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    <span
                      className="text-[0.68rem] flex-shrink-0 [font-variant-numeric:tabular-nums]"
                      style={{ color: "rgba(165,182,214,0.3)", width: 60, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {v.toLocaleString()}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Previous snapshots summary */}
          {snapshots.length > 1 && (
            <div className="mt-5">
              <div className="text-[0.60rem] font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(165,182,214,0.25)" }}>
                Previous Snapshots
              </div>
              <div className="flex flex-col gap-[4px]">
                {snapshots.slice(1, 5).map(snap => {
                  const total = Object.values(snap.sourcesJson).reduce((s, n) => s + n, 0);
                  return (
                    <div key={snap.id} className="flex items-center gap-3">
                      <span className="text-[0.68rem]" style={{ color: "rgba(165,182,214,0.3)", width: 130, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmtDate(snap.createdAt)}
                      </span>
                      <span className="text-[0.68rem] [font-variant-numeric:tabular-nums]" style={{ color: "rgba(165,182,214,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {total.toLocaleString()} visits
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        !open && (
          <p className="text-[0.78rem]" style={{ color: "rgba(165,182,214,0.3)" }}>
            No traffic data yet. Record your monthly source breakdown above.
          </p>
        )
      )}
    </div>
  );
}

// ── MonitorPage ───────────────────────────────────────────────────────────────

function MonitorPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const productId = data.productId;

  function refresh() {
    router.invalidate();
  }

  return (
    <div className="overflow-y-auto h-full px-6 py-5 pb-10">
      <div className="max-w-[680px]">
        <MrrSection
          snapshots={data.mrrSnapshots}
          productId={productId}
          onSaved={refresh}
        />
        <CacSection
          entries={data.cacEntries}
          productId={productId}
          onSaved={refresh}
        />
        <TrafficSection
          snapshots={data.trafficSnapshots}
          productId={productId}
          onSaved={refresh}
        />
      </div>
    </div>
  );
}
