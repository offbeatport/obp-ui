import {
    type Column,
    type ColumnDef,
    type Row,
    type SortingState,
    type Table,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { type Virtualizer, useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import {
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    type RefObject,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { cn } from "../lib/cn";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { TableCell, TableHead, TableRow } from "../primitives/table";

const INTERACTIVE =
    "a, button, input, select, textarea, label, summary, [role='menuitem'], [role='checkbox'], [role='switch'], [role='tab'], [data-grid-ignore]";
const MIN_COLUMN = 48;
const RESIZE_STEP = 16;
const VIRTUAL_FROM = 150;
const ESTIMATED_ROW = 44;

type Widths = Record<string, number>;
type AnyVirtualizer = Virtualizer<HTMLElement, Element> | Virtualizer<Window, Element>;

export type DataGridProps<T> = {
    columns: ColumnDef<T, unknown>[];
    rows: T[];
    getRowId?: (row: T, index: number) => string;
    onOpen?: (row: T) => void;
    rowLabel?: (row: T) => string;
    empty?: ReactNode;
    initialSort?: SortingState;
    sortable?: boolean;
    resizable?: boolean;
    virtualize?: boolean;
    maxHeight?: string;
    minWidth?: string;
    storageKey?: string;
    columnPicker?: boolean;
    hiddenColumns?: string[];
    className?: string;
};

function readWidths(key: string | undefined): Widths {
    if (!key) {
        return {};
    }
    try {
        return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Widths;
    } catch {
        return {};
    }
}

function writeWidths(key: string | undefined, widths: Widths): void {
    if (!key) {
        return;
    }
    try {
        window.localStorage.setItem(key, JSON.stringify(widths));
    } catch {
        return;
    }
}

function readVisibility(key: string | undefined, hidden: string[]): VisibilityState {
    const defaults = Object.fromEntries(hidden.map((id) => [id, false]));
    if (!key) {
        return defaults;
    }
    try {
        const stored = JSON.parse(window.localStorage.getItem(`${key}.visible`) ?? "{}");
        return { ...defaults, ...(stored as VisibilityState) };
    } catch {
        return defaults;
    }
}

function writeVisibility(key: string | undefined, visibility: VisibilityState): void {
    if (!key) {
        return;
    }
    try {
        window.localStorage.setItem(`${key}.visible`, JSON.stringify(visibility));
    } catch {
        return;
    }
}

function ColumnPicker<T>({ table }: { table: Table<T> }) {
    const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());
    if (columns.length === 0) {
        return null;
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Choose columns"
                    title="Choose columns"
                    className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <Columns3 className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        closeOnClick={false}
                        onCheckedChange={(value) => column.toggleVisibility(value === true)}
                    >
                        {headerLabel(column)}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function scrollParent(node: HTMLElement | null): HTMLElement | null {
    for (let element = node?.parentElement; element; element = element.parentElement) {
        if (/(auto|scroll|overlay)/.test(getComputedStyle(element).overflowY)) {
            return element;
        }
    }
    return null;
}

function ariaSort(column: Column<unknown, unknown>) {
    const sorted = column.getIsSorted();
    if (sorted === "asc") {
        return "ascending" as const;
    }
    return sorted === "desc" ? ("descending" as const) : undefined;
}

function Resizer({
    label,
    onStart,
    onStep,
    onReset,
}: {
    label: string;
    onStart: (event: PointerEvent<HTMLElement>) => void;
    onStep: (delta: number) => void;
    onReset: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={`Resize ${label}`}
            title="Drag to resize, double-click to reset"
            onPointerDown={onStart}
            onMouseDown={(event) => event.preventDefault()}
            onDoubleClick={onReset}
            onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    onStep(event.key === "ArrowLeft" ? -RESIZE_STEP : RESIZE_STEP);
                }
            }}
            className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize touch-none select-none outline-none after:absolute after:inset-y-1.5 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-primary focus-visible:after:bg-primary"
        />
    );
}

function headerLabel<T>(column: Column<T, unknown>): string {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
}

function useColumnWidths<T>(
    table: Table<T>,
    cells: RefObject<Map<string, HTMLTableCellElement>>,
    storageKey: string | undefined,
) {
    const [widths, setWidths] = useState<Widths>(() => readWidths(storageKey));
    useEffect(() => writeWidths(storageKey, widths), [storageKey, widths]);
    const resizable = table.getVisibleLeafColumns().slice(0, -1);
    const measured = (): Widths =>
        Object.keys(widths).length > 0
            ? widths
            : Object.fromEntries(
                  resizable.map((column) => [
                      column.id,
                      Math.round(
                          cells.current.get(column.id)?.getBoundingClientRect().width ?? 120,
                      ),
                  ]),
              );
    const clamp = (column: Column<T, unknown>, width: number) =>
        Math.max(column.columnDef.minSize ?? MIN_COLUMN, Math.round(width));
    const start = (event: PointerEvent<HTMLElement>, column: Column<T, unknown>) => {
        event.preventDefault();
        event.stopPropagation();
        const base = measured();
        const from = base[column.id] ?? 120;
        const x = event.clientX;
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const move = (next: globalThis.PointerEvent) =>
            setWidths({ ...base, [column.id]: clamp(column, from + next.clientX - x) });
        const stop = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", stop);
            target.removeEventListener("pointercancel", stop);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", stop);
        target.addEventListener("pointercancel", stop);
    };
    const step = (column: Column<T, unknown>, delta: number) => {
        const base = measured();
        setWidths({ ...base, [column.id]: clamp(column, (base[column.id] ?? 120) + delta) });
    };
    const reset = (column: Column<T, unknown>) =>
        setWidths((current) => {
            const { [column.id]: _, ...rest } = current;
            return rest;
        });
    return { widths, resizable, start, step, reset };
}

function useOverflowing(
    container: RefObject<HTMLDivElement | null>,
    table: RefObject<HTMLTableElement | null>,
) {
    const [overflowing, setOverflowing] = useState(false);
    useLayoutEffect(() => {
        const box = container.current;
        const inner = table.current;
        if (!box || !inner) {
            return;
        }
        const check = () => setOverflowing(inner.scrollWidth > box.clientWidth + 1);
        check();
        const observer = new ResizeObserver(check);
        observer.observe(box);
        observer.observe(inner);
        return () => observer.disconnect();
    }, [container, table]);
    return overflowing;
}

type Scroller = { kind: "element"; element: HTMLElement } | { kind: "window" };

function offsetIn(scroller: Scroller, body: HTMLElement): number {
    const top = body.getBoundingClientRect().top;
    if (scroller.kind === "window") {
        return top + window.scrollY;
    }
    const { element } = scroller;
    return top - element.getBoundingClientRect().top + element.scrollTop;
}

type RowsProps<T> = {
    rows: Row<T>[];
    body: RefObject<HTMLTableSectionElement | null>;
    renderRow: (row: Row<T>, index: number, measure?: (node: Element | null) => void) => ReactNode;
    span: number;
    target: RefObject<AnyVirtualizer | null>;
};

function Spacers<T>({
    virtualizer,
    margin,
    props,
}: {
    virtualizer: AnyVirtualizer;
    margin: number;
    props: RowsProps<T>;
}) {
    const items = virtualizer.getVirtualItems();
    const first = items[0];
    const last = items.at(-1);
    const top = first ? first.start - margin : 0;
    const bottom = last ? virtualizer.getTotalSize() - (last.end - margin) : 0;
    return (
        <>
            {top > 0 && (
                <tr>
                    <td colSpan={props.span} style={{ height: top, padding: 0 }} />
                </tr>
            )}
            {items.map((item) => {
                const row = props.rows[item.index];
                return row ? props.renderRow(row, item.index, virtualizer.measureElement) : null;
            })}
            {bottom > 0 && (
                <tr>
                    <td colSpan={props.span} style={{ height: bottom, padding: 0 }} />
                </tr>
            )}
        </>
    );
}

function useMargin(scroller: Scroller, body: RefObject<HTMLTableSectionElement | null>) {
    const [margin, setMargin] = useState(0);
    useLayoutEffect(() => {
        const measure = () => body.current && setMargin(offsetIn(scroller, body.current));
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [scroller, body]);
    return margin;
}

function ElementRows<T>({ element, ...props }: RowsProps<T> & { element: HTMLElement }) {
    const scroller = useRef<Scroller>({ kind: "element", element }).current;
    const margin = useMargin(scroller, props.body);
    const virtualizer = useVirtualizer({
        count: props.rows.length,
        getScrollElement: () => element,
        estimateSize: () => ESTIMATED_ROW,
        overscan: 8,
        scrollMargin: margin,
    });
    const { target } = props;
    useEffect(() => {
        target.current = virtualizer;
    }, [target, virtualizer]);
    return <Spacers virtualizer={virtualizer} margin={margin} props={props} />;
}

function WindowRows<T>(props: RowsProps<T>) {
    const scroller = useRef<Scroller>({ kind: "window" }).current;
    const margin = useMargin(scroller, props.body);
    const virtualizer = useWindowVirtualizer({
        count: props.rows.length,
        estimateSize: () => ESTIMATED_ROW,
        overscan: 8,
        scrollMargin: margin,
    });
    const { target } = props;
    useEffect(() => {
        target.current = virtualizer;
    }, [target, virtualizer]);
    return <Spacers virtualizer={virtualizer} margin={margin} props={props} />;
}

export function DataGrid<T>({
    columns,
    rows,
    getRowId,
    onOpen,
    rowLabel,
    empty = "Nothing here yet.",
    initialSort = [],
    sortable = true,
    resizable = true,
    virtualize,
    maxHeight,
    minWidth,
    storageKey,
    columnPicker = false,
    hiddenColumns = [],
    className,
}: DataGridProps<T>) {
    const [sorting, setSorting] = useState<SortingState>(initialSort);
    const [visibility, setVisibility] = useState<VisibilityState>(() =>
        readVisibility(storageKey, hiddenColumns),
    );
    useEffect(() => writeVisibility(storageKey, visibility), [storageKey, visibility]);
    const table = useReactTable({
        data: rows,
        columns,
        getRowId,
        state: { sorting, columnVisibility: visibility },
        enableSorting: sortable,
        onSortingChange: setSorting,
        onColumnVisibilityChange: setVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    const container = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const body = useRef<HTMLTableSectionElement>(null);
    const cells = useRef(new Map<string, HTMLTableCellElement>());
    const virtualizer = useRef<AnyVirtualizer | null>(null);
    const sizing = useColumnWidths(table, cells, storageKey);
    const overflowing = useOverflowing(container, tableRef);
    const sorted = table.getRowModel().rows;
    const leaves = table.getVisibleLeafColumns();
    const virtual = (virtualize ?? sorted.length >= VIRTUAL_FROM) && sorted.length > 0;
    const [scroller, setScroller] = useState<Scroller | null>(null);
    useLayoutEffect(() => {
        if (!virtual || scroller) {
            return;
        }
        const element = maxHeight ? container.current : scrollParent(container.current);
        setScroller(element ? { kind: "element", element } : { kind: "window" });
    }, [virtual, scroller, maxHeight]);
    const fixed = Object.keys(sizing.widths).length > 0;
    const fixedTotal = sizing.resizable.reduce(
        (sum, column) => sum + (sizing.widths[column.id] ?? 120),
        0,
    );

    const focusRow = (index: number) => {
        const target = Math.max(0, Math.min(index, sorted.length - 1));
        const focus = () =>
            body.current?.querySelector<HTMLTableRowElement>(`tr[data-index="${target}"]`)?.focus();
        if (virtual && virtualizer.current) {
            virtualizer.current.scrollToIndex(target, { align: "auto" });
            requestAnimationFrame(focus);
        } else {
            focus();
        }
    };
    const onClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
        const target = event.target as HTMLElement;
        if (
            event.button !== 0 ||
            !event.currentTarget.contains(target) ||
            target.closest(INTERACTIVE) ||
            window.getSelection()?.toString()
        ) {
            return;
        }
        onOpen?.(row);
    };
    const onKey = (event: KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
        if (
            event.target !== event.currentTarget &&
            (event.target as HTMLElement).closest(INTERACTIVE)
        ) {
            return;
        }
        const moves: Record<string, number> = {
            ArrowDown: index + 1,
            ArrowUp: index - 1,
            Home: 0,
            End: sorted.length - 1,
        };
        const move = moves[event.key];
        if (move !== undefined) {
            event.preventDefault();
            focusRow(move);
        } else if (event.key === "Enter" && onOpen) {
            event.preventDefault();
            onOpen(row);
        }
    };
    const renderRow = (row: Row<T>, index: number, measure?: (node: Element | null) => void) => (
        <TableRow
            key={row.id}
            ref={measure}
            data-index={index}
            tabIndex={onOpen ? 0 : undefined}
            aria-label={rowLabel?.(row.original)}
            onKeyDown={onOpen ? (event) => onKey(event, index, row.original) : undefined}
            onClick={onOpen ? (event) => onClick(event, row.original) : undefined}
            className={cn(onOpen && "cursor-pointer outline-none focus-visible:bg-secondary")}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell
                    key={cell.id}
                    className={cn("py-2", fixed && "overflow-hidden text-ellipsis")}
                >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    );
    const rowsProps: RowsProps<T> = {
        rows: sorted,
        body,
        renderRow,
        span: leaves.length,
        target: virtualizer,
    };
    let content: ReactNode;
    if (sorted.length === 0) {
        content = (
            <TableRow>
                <TableCell colSpan={leaves.length} className="py-8 whitespace-normal">
                    {empty}
                </TableCell>
            </TableRow>
        );
    } else if (!virtual) {
        content = sorted.map((row, index) => renderRow(row, index));
    } else if (scroller?.kind === "element") {
        content = <ElementRows {...rowsProps} element={scroller.element} />;
    } else if (scroller?.kind === "window") {
        content = <WindowRows {...rowsProps} />;
    }
    return (
        <div
            ref={container}
            data-slot="data-grid"
            className={cn(
                "relative w-full rounded-md border",
                maxHeight ? "overflow-auto" : overflowing ? "overflow-x-auto" : "overflow-clip",
                className,
            )}
            style={maxHeight ? { maxHeight } : undefined}
        >
            <table
                ref={tableRef}
                data-slot="table"
                className={cn("w-full caption-bottom text-sm", !fixed && minWidth)}
                style={
                    fixed
                        ? { tableLayout: "fixed", minWidth: `${fixedTotal + MIN_COLUMN * 2}px` }
                        : undefined
                }
            >
                {fixed && (
                    <colgroup>
                        {leaves.map((column) => (
                            <col
                                key={column.id}
                                style={
                                    sizing.widths[column.id] !== undefined
                                        ? { width: sizing.widths[column.id] }
                                        : undefined
                                }
                            />
                        ))}
                    </colgroup>
                )}
                <thead data-slot="table-header" className="[&_tr]:border-b">
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id} className="hover:bg-transparent">
                            {group.headers.map((header, position) => {
                                const column = header.column;
                                const title = flexRender(
                                    column.columnDef.header,
                                    header.getContext(),
                                );
                                const last = position === group.headers.length - 1;
                                return (
                                    <TableHead
                                        key={header.id}
                                        ref={(node) => {
                                            if (node) {
                                                cells.current.set(column.id, node);
                                            } else {
                                                cells.current.delete(column.id);
                                            }
                                        }}
                                        aria-sort={ariaSort(column as Column<unknown, unknown>)}
                                        className={cn(
                                            "sticky top-0 z-[1] overflow-visible",
                                            columnPicker && last && "pr-9",
                                        )}
                                    >
                                        {column.getCanSort() ? (
                                            <button
                                                type="button"
                                                onClick={column.getToggleSortingHandler()}
                                                className="inline-flex max-w-full items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                            >
                                                <span className="truncate">{title}</span>
                                                {column.getIsSorted() === "asc" && (
                                                    <ChevronUp className="size-3.5 shrink-0" />
                                                )}
                                                {column.getIsSorted() === "desc" && (
                                                    <ChevronDown className="size-3.5 shrink-0" />
                                                )}
                                            </button>
                                        ) : (
                                            title
                                        )}
                                        {resizable &&
                                            !last &&
                                            column.columnDef.enableResizing !== false && (
                                                <Resizer
                                                    label={headerLabel(column)}
                                                    onStart={(event) => sizing.start(event, column)}
                                                    onStep={(delta) => sizing.step(column, delta)}
                                                    onReset={() => sizing.reset(column)}
                                                />
                                            )}
                                        {columnPicker && last && <ColumnPicker table={table} />}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </thead>
                <tbody ref={body} data-slot="table-body" className="[&_tr:last-child]:border-0">
                    {content}
                </tbody>
            </table>
        </div>
    );
}
