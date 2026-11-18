import {
    type CSSProperties,
    type PointerEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { cn } from "../lib/cn";
import { prefStorage } from "../lib/storage";

export type ColumnSize = {
    id: string;
    width: number;
    min?: number;
    max?: number;
    flex?: boolean;
};

export type ColumnResizerProps = {
    label: string;
    title?: string;
    onStart: (event: PointerEvent<HTMLElement>) => void;
    onStep: (delta: number) => void;
    onDoubleClick: () => void;
    className?: string;
};

export type ColumnHandle = Omit<ColumnResizerProps, "className" | "title">;

export type ColumnSizing = {
    tableRef: (node: HTMLTableElement | null) => void;
    tableStyle: CSSProperties;
    colStyle: (id: string) => CSSProperties | undefined;
    width: (id: string) => number | undefined;
    handle: (id: string, label: string) => ColumnHandle | null;
    fit: (id: string) => void;
    reset: () => void;
    customized: boolean;
};

type Widths = Record<string, number>;

const MIN_COLUMN = 48;
const MAX_FIT = 480;
const STEP = 16;
const MEASURED_CELLS = 200;
const PROBE =
    "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;width:max-content;white-space:nowrap;";

function readWidths(key: string | undefined): Widths {
    if (!key) {
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(prefStorage().get(key) ?? "{}");
        return parsed && typeof parsed === "object" ? (parsed as Widths) : {};
    } catch {
        return {};
    }
}

function writeWidths(key: string | undefined, widths: Widths): void {
    if (!key) {
        return;
    }
    if (Object.keys(widths).length === 0) {
        prefStorage().remove(key);
    } else {
        prefStorage().set(key, JSON.stringify(widths));
    }
}

function release(node: Element): void {
    if (node instanceof HTMLElement) {
        node.style.containerType = "normal";
        node.style.maxWidth = "none";
    }
    for (const child of node.children) {
        release(child);
    }
}

function naturalWidth(cell: HTMLElement, host: HTMLElement): number {
    const style = getComputedStyle(cell);
    const probe = document.createElement("div");
    probe.style.cssText = PROBE;
    probe.style.font = style.font;
    probe.style.fontVariantNumeric = style.fontVariantNumeric;
    probe.style.fontFeatureSettings = style.fontFeatureSettings;
    probe.style.letterSpacing = style.letterSpacing;
    for (const child of cell.childNodes) {
        if (!(child instanceof HTMLElement && child.dataset.columnResizer !== undefined)) {
            probe.appendChild(child.cloneNode(true));
        }
    }
    release(probe);
    host.appendChild(probe);
    const content = probe.getBoundingClientRect().width;
    probe.remove();
    const frame =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight) +
        Number.parseFloat(style.borderLeftWidth) +
        Number.parseFloat(style.borderRightWidth);
    return Math.ceil(content + frame) + 1;
}

function measure(table: HTMLTableElement, id: string): number | null {
    const cells = [
        ...table.querySelectorAll<HTMLElement>(`[data-column="${CSS.escape(id)}"]`),
    ].slice(0, MEASURED_CELLS);
    if (cells.length === 0) {
        return null;
    }
    const host = table.parentElement ?? document.body;
    return Math.max(...cells.map((cell) => naturalWidth(cell, host)));
}

function clampTo(column: ColumnSize, width: number, max = Number.POSITIVE_INFINITY): number {
    return Math.round(Math.min(max, Math.max(column.min ?? MIN_COLUMN, width)));
}

function sum(widths: Widths): number {
    return Object.values(widths).reduce((total, width) => total + width, 0);
}

function capped(natural: Widths, base: Widths, level: number): Widths {
    return Object.fromEntries(
        Object.entries(natural).map(([id, width]) => [
            id,
            Math.round(Math.min(width, Math.max(base[id] ?? width, level))),
        ]),
    );
}

function fitInto(natural: Widths, base: Widths, room: number): Widths {
    if (sum(natural) <= room) {
        return natural;
    }
    let low = 0;
    let high = Math.max(0, ...Object.values(natural));
    for (let step = 0; step < 24; step += 1) {
        const level = (low + high) / 2;
        if (sum(capped(natural, base, level)) > room) {
            high = level;
        } else {
            low = level;
        }
    }
    return capped(natural, base, low);
}

export function ColumnResizer({
    label,
    title = "Drag to resize, double-click to fit",
    onStart,
    onStep,
    onDoubleClick,
    className,
}: ColumnResizerProps) {
    return (
        <button
            type="button"
            data-column-resizer=""
            aria-label={`Resize ${label}`}
            title={title}
            onPointerDown={onStart}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={onDoubleClick}
            onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    onStep(event.key === "ArrowLeft" ? -STEP : STEP);
                }
            }}
            className={cn(
                "absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none outline-none after:absolute after:inset-y-1 after:right-0 after:w-px after:bg-input after:opacity-0 hover:after:w-0.5 hover:after:bg-primary focus-visible:after:w-0.5 focus-visible:after:bg-primary focus-visible:after:opacity-100 active:after:opacity-100 [tr:hover_&]:after:opacity-100",
                className,
            )}
        />
    );
}

export function useColumnSizing({
    columns,
    storageKey,
    fitKey,
}: {
    columns: ColumnSize[];
    storageKey?: string;
    fitKey?: string;
}): ColumnSizing {
    const [stored, setStored] = useState<Widths>(() => readWidths(storageKey));
    const [fitted, setFitted] = useState<Widths>({});
    const [table, setTable] = useState<HTMLTableElement | null>(null);
    const latest = useRef(columns);
    latest.current = columns;
    useEffect(() => writeWidths(storageKey, stored), [storageKey, stored]);
    const columnOf = (id: string) => columns.find((column) => column.id === id);
    const width = (id: string): number | undefined => {
        const column = columnOf(id);
        if (!column || column.flex) {
            return undefined;
        }
        return stored[id] ?? fitted[id] ?? column.width;
    };
    const fitAll = useCallback(
        (keep: Widths) => {
            if (!table) {
                return;
            }
            const natural: Widths = {};
            const base: Widths = {};
            let fixed = 0;
            for (const column of latest.current) {
                const kept = keep[column.id];
                const found = column.flex || kept !== undefined ? null : measure(table, column.id);
                if (column.flex) {
                    fixed += column.min ?? column.width;
                } else if (kept !== undefined) {
                    fixed += kept;
                } else if (found === null) {
                    fixed += column.width;
                } else {
                    base[column.id] = clampTo(column, column.width);
                    natural[column.id] = clampTo(
                        column,
                        Math.max(found, column.width),
                        column.max ?? MAX_FIT,
                    );
                }
            }
            const room = (table.parentElement?.clientWidth ?? Number.POSITIVE_INFINITY) - fixed;
            setFitted(fitInto(natural, base, room));
        },
        [table],
    );
    const storedRef = useRef(stored);
    storedRef.current = stored;
    useLayoutEffect(() => {
        if (fitKey !== undefined) {
            fitAll(storedRef.current);
        }
    }, [fitAll, fitKey]);
    const fitting = fitKey !== undefined;
    useEffect(() => {
        const box = table?.parentElement;
        if (!box || !fitting) {
            return;
        }
        let last = box.clientWidth;
        const observer = new ResizeObserver(() => {
            if (box.clientWidth !== last) {
                last = box.clientWidth;
                fitAll(storedRef.current);
            }
        });
        observer.observe(box);
        return () => observer.disconnect();
    }, [table, fitting, fitAll]);
    const set = (id: string, next: number) => {
        const column = columnOf(id);
        if (column) {
            setStored((current) => ({ ...current, [id]: clampTo(column, next) }));
        }
    };
    const start = (event: PointerEvent<HTMLElement>, id: string) => {
        event.preventDefault();
        event.stopPropagation();
        const from = width(id) ?? 0;
        const x = event.clientX;
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const move = (next: globalThis.PointerEvent) => set(id, from + next.clientX - x);
        const stop = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", stop);
            target.removeEventListener("pointercancel", stop);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", stop);
        target.addEventListener("pointercancel", stop);
    };
    const fit = (id: string) => {
        const natural = table ? measure(table, id) : null;
        if (natural !== null) {
            set(id, natural);
        }
    };
    const reset = () => {
        setStored({});
        fitAll({});
    };
    const fixedTotal = columns.reduce(
        (sum, column) =>
            sum + (column.flex ? (column.min ?? column.width) : (width(column.id) ?? 0)),
        0,
    );
    return {
        tableRef: setTable,
        tableStyle: { tableLayout: "fixed", width: "100%", minWidth: `${fixedTotal}px` },
        colStyle: (id) => {
            const found = width(id);
            return found === undefined ? undefined : { width: `${found}px` };
        },
        width,
        handle: (id, label) =>
            columnOf(id)?.flex
                ? null
                : {
                      label,
                      onStart: (event) => start(event, id),
                      onStep: (delta) => set(id, (width(id) ?? 0) + delta),
                      onDoubleClick: () => fit(id),
                  },
        fit,
        reset,
        customized: Object.keys(stored).length > 0,
    };
}
