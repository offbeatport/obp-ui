import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "../utils/cn";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  className?: string;
  /** Shown when `data` is empty. */
  emptyState?: React.ReactNode;
  /** Shown above the rows while data is loading (covers the table body). */
  loading?: boolean;
  /** Default sort. */
  initialSorting?: SortingState;
}

/**
 * Styled wrapper around `@tanstack/react-table`. Defaults to client-side
 * sorting; pass `manualSorting`-style options through if you want to wire
 * a server-side fetcher (advanced - drop down to `useReactTable` directly).
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  emptyState,
  loading = false,
  initialSorting = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("rounded-md border border-border overflow-hidden bg-field", className)}>
      <table className="w-full text-left">
        <thead className="bg-hover">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle whitespace-nowrap",
                      canSort && "cursor-pointer select-none hover:text-fg",
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="text-fg-subtle/60">
                          {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-fg-muted text-[13px]">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                {emptyState ?? (
                  <span className="text-fg-muted text-[13px]">No results.</span>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0 hover:bg-hover/60"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-[14px] text-fg align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { type ColumnDef, type SortingState } from "@tanstack/react-table";
