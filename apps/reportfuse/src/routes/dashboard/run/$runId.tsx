import { createFileRoute } from "@tanstack/react-router";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@offbeatport/ui/ui/dropdown-menu";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Columns3, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CANONICAL_COLUMNS, type CanonicalRow } from "../../../features/normalizer";

export const Route = createFileRoute("/dashboard/run/$runId")({
  component: RunDetail,
});

interface RunFull {
  id: string;
  inputFileNames: string[];
  rowCount: number;
  prevRowCount: number | null;
  platformsDetected: string[];
  outputRows: CanonicalRow[];
  schemaChanges: Array<{ platform: string; message: string }>;
  warnings: string[];
  createdAt: string | number;
}

const DEFAULT_VISIBILITY: VisibilityState = {
  date: true, platform: true, campaign: true, adset: false, ad: false,
  spend: true, impressions: true, clicks: true, cpc: true, ctr: true,
  conversions: true, roas: true,
};

const COL_LABELS: Record<string, string> = {
  date: "Date", platform: "Platform", campaign: "Campaign", adset: "Ad Set",
  ad: "Ad", spend: "Spend", impressions: "Impressions", clicks: "Clicks",
  cpc: "CPC", ctr: "CTR", conversions: "Conversions", roas: "ROAS",
};

const PLATFORM_COLORS: Record<string, string> = {
  "Google Ads": "#4285F4", "Meta Ads": "#0081FB", "TikTok": "#010101",
  "LinkedIn": "#0A66C2", "X Ads": "#000000", "Snapchat": "#FFFC00",
  "Pinterest": "#E60023", "GA4": "#E37400",
};
const EXTRA_COLORS = ["#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

function platformColor(name: string, idx: number): string {
  return PLATFORM_COLORS[name] ?? EXTRA_COLORS[idx % EXTRA_COLORS.length]!;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function RunDetail() {
  const { runId } = Route.useParams();
  const [run, setRun] = useState<RunFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((d) => { setRun(d.run ?? null); setLoading(false); })
      .catch(() => { setError("Failed to load run."); setLoading(false); });
  }, [runId]);

  // Build a stable color map: platform name → hex
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (run?.platformsDetected ?? []).forEach((p, i) => { map[p] = platformColor(p, i); });
    return map;
  }, [run?.platformsDetected]);

  const columns = useMemo<ColumnDef<CanonicalRow>[]>(
    () =>
      CANONICAL_COLUMNS.map((col) => ({
        id: col,
        accessorKey: col,
        header: COL_LABELS[col] ?? col,
        cell: ({ getValue }) => {
          const val = getValue();
          if (val === null || val === undefined || val === "") return <span className="text-fg-subtle">-</span>;
          if (typeof val === "number") return fmtNum(col, val);
          return String(val);
        },
      })),
    [],
  );

  const table = useReactTable({
    data: run?.outputRows ?? [],
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibleCount = table.getVisibleLeafColumns().length;
  const allVisible = visibleCount === CANONICAL_COLUMNS.length;

  function downloadCSV() {
    if (!run?.outputRows.length) return;
    const visibleCols = table.getVisibleLeafColumns().map((c) => c.id as keyof CanonicalRow);
    const headers = visibleCols.join(",");
    const body = run.outputRows
      .map((r) => visibleCols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return "";
        const s = String(v);
        return s.includes(",") ? `"${s}"` : s;
      }).join(","))
      .join("\n");
    const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reportfuse-${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!run?.outputRows.length) return;
    const visibleCols = table.getVisibleLeafColumns().map((c) => c.id as keyof CanonicalRow);
    const ws = XLSX.utils.json_to_sheet(run.outputRows.map((r) => Object.fromEntries(visibleCols.map((c) => [c, r[c]]))), { header: visibleCols as string[] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ReportFuse");
    XLSX.writeFile(wb, `reportfuse-${runId.slice(0, 8)}.xlsx`);
  }

  function fmtDate(ts: string | number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-fg-muted">Loading...</div>;
  if (error || !run) {
    return (
      <div className="flex items-center gap-2 m-8 px-4 py-3 bg-danger/8 border border-danger/25 text-sm text-danger">
        <AlertTriangle size={14} /> {error ?? "Run not found."}
      </div>
    );
  }

  const rowDiff = run.prevRowCount !== null && run.prevRowCount !== undefined
    ? run.rowCount - run.prevRowCount : null;

  return (
    <div className="flex flex-col h-full">
      {/* Schema change alert */}
      {run.schemaChanges?.length > 0 && (
        <div className="px-6 py-3 bg-warning/8 border-b border-warning/30 flex flex-col gap-1 shrink-0">
          {run.schemaChanges.map((sc) => (
            <div key={sc.platform} className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle size={12} className="shrink-0" /> {sc.message}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {run.platformsDetected.map((p) => {
              const c = colorMap[p]!;
              return (
                <span key={p} className="text-xs font-mono px-1.5 py-0.5 border"
                  style={{ backgroundColor: hexToRgba(c, 0.1), borderColor: hexToRgba(c, 0.3), color: c }}>
                  {p}
                </span>
              );
            })}
            {rowDiff !== null && rowDiff !== 0 && (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 border ${rowDiff > 0 ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"}`}>
                {rowDiff > 0 ? "+" : ""}{rowDiff.toLocaleString()} vs prev
              </span>
            )}
          </div>
          <p className="text-xs text-fg-muted font-mono">
            {run.inputFileNames.join(", ")} &middot; {run.rowCount.toLocaleString()} rows &middot; {fmtDate(run.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-fg bg-primary border border-primary hover:brightness-110 transition-all">
            <Download size={13} /> Download CSV
          </button>
          <button type="button" onClick={downloadXLSX}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-fg bg-bg-elevated hover:bg-hover transition-all border border-border">
            <Download size={13} /> XLSX
          </button>
        </div>
      </div>

      {/* Toolbar: filter + column picker */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border shrink-0">
        <input
          type="text"
          placeholder="Filter rows..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-border bg-bg text-fg placeholder:text-fg-muted outline-none focus:border-primary/60 transition-colors w-48"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-fg-muted hover:text-fg hover:bg-hover transition-colors">
              <Columns3 size={13} />
              Columns
              {!allVisible && (
                <span className="ml-0.5 px-1 py-px bg-primary text-primary-fg text-[9px] font-mono leading-none">{visibleCount}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault();
              if (allVisible) setColumnVisibility(DEFAULT_VISIBILITY);
              else setColumnVisibility(Object.fromEntries(CANONICAL_COLUMNS.map((c) => [c, true])));
            }} className="text-xs text-fg-muted">
              {allVisible ? "Reset to defaults" : "Show all"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().map((col) => (
              <DropdownMenuItem key={col.id}
                onSelect={(e) => { e.preventDefault(); col.toggleVisibility(); }}
                className="text-xs flex items-center justify-between">
                <span className="font-mono">{COL_LABELS[col.id] ?? col.id}</span>
                {col.getIsVisible() && <Check size={12} className="text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-xs text-fg-subtle ml-auto font-mono">
          {table.getFilteredRowModel().rows.length.toLocaleString()} rows
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-bg-elevated">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-2.5 text-left font-mono font-medium text-fg-muted whitespace-nowrap cursor-pointer hover:text-fg select-none">
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ChevronUp size={11} /> : sorted === "desc" ? <ChevronDown size={11} /> : <ChevronsUpDown size={11} className="opacity-25" />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => {
              const platform = row.getValue<string>("platform");
              const color = platform ? colorMap[platform] ?? null : null;
              return (
                <tr key={row.id}
                  style={color ? { backgroundColor: hexToRgba(color, i % 2 === 0 ? 0.07 : 0.12) } : undefined}
                  className={`border-b border-border/50 last:border-0 hover:brightness-95 dark:hover:brightness-110 transition-none ${!color ? (i % 2 === 0 ? "bg-bg" : "bg-bg-elevated/40") : ""}`}>
                  {row.getVisibleCells().map((cell) => {
                    const isNum = typeof cell.getValue() === "number";
                    const isPlatformCol = cell.column.id === "platform";
                    return (
                      <td key={cell.id}
                        className={`px-3 py-2 whitespace-nowrap text-fg ${isNum ? "font-mono text-right" : ""}`}>
                        {isPlatformCol && color ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        ) : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={visibleCount} className="px-3 py-10 text-center text-fg-muted">No rows match the filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtNum(col: string, val: number): string {
  if (col === "spend" || col === "cpc") return `$${val.toFixed(2)}`;
  if (col === "ctr") return `${val.toFixed(2)}%`;
  if (col === "roas") return `${val.toFixed(2)}x`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}
