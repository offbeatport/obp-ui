"use client";

import { type CSSProperties, Fragment, type ReactNode, type UIEvent, useRef } from "react";
import { cn } from "../lib/cn";

export type CompareColumn = {
    id: string;
    header: ReactNode;
};

export type CompareRow = {
    id: string;
    label: ReactNode;
    cells: ReactNode[];
    differs?: boolean;
};

export type CompareSection = {
    id: string;
    title?: ReactNode;
    rows: CompareRow[];
};

export type CompareTableProps = {
    label: string;
    columns: CompareColumn[];
    sections: CompareSection[];
    corner?: ReactNode;
    labelWidth?: string;
    columnWidth?: string;
    stickyTop?: string;
    differsLabel?: string;
    className?: string;
};

type Side = "head" | "body";

const SURFACE = "bg-(--compare-surface,var(--background))";
const ROW = "grid min-w-(--compare-min) grid-cols-(--compare-columns)";
const PINNED = cn("sticky left-0 z-[1] min-w-0 border-r", SURFACE);
const CELL = "min-w-0 border-r px-3 last:border-r-0";
const SCROLLER =
    "overflow-x-auto overscroll-x-contain [scroll-padding-inline-start:var(--compare-label)]";

function useLinkedScroll() {
    const head = useRef<HTMLDivElement>(null);
    const body = useRef<HTMLDivElement>(null);
    const echo = useRef<Record<Side, number | null>>({ head: null, body: null });
    const follow = (side: Side) => (event: UIEvent<HTMLDivElement>) => {
        const left = event.currentTarget.scrollLeft;
        if (echo.current[side] === left) {
            echo.current[side] = null;
            return;
        }
        const other: Side = side === "head" ? "body" : "head";
        const target = (other === "head" ? head : body).current;
        if (!target || target.scrollLeft === left) {
            return;
        }
        target.scrollLeft = left;
        echo.current[other] = target.scrollLeft;
    };
    return { head, body, onHeadScroll: follow("head"), onBodyScroll: follow("body") };
}

function CompareTable({
    label,
    columns,
    sections,
    corner,
    labelWidth = "clamp(7.5rem, 28cqi, 11rem)",
    columnWidth = "13rem",
    stickyTop = "0px",
    differsLabel = "differs",
    className,
}: CompareTableProps) {
    const { head, body, onHeadScroll, onBodyScroll } = useLinkedScroll();
    const count = columns.length;
    const style = {
        "--compare-label": labelWidth,
        "--compare-column": columnWidth,
        "--compare-columns": `var(--compare-label) repeat(${count}, minmax(var(--compare-column), 1fr))`,
        "--compare-min": `calc(var(--compare-label) + ${count} * var(--compare-column))`,
    } as CSSProperties;
    const shown = sections.filter((section) => section.rows.length > 0);
    return (
        <div
            role="table"
            aria-label={label}
            aria-colcount={count + 1}
            data-slot="compare-table"
            className={cn(
                "@container relative overflow-clip rounded-md border",
                SURFACE,
                className,
            )}
            style={style}
        >
            <div
                ref={head}
                role="rowgroup"
                data-slot="compare-table-header"
                onScroll={onHeadScroll}
                className={cn(
                    "sticky z-[2] border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    SCROLLER,
                    SURFACE,
                )}
                style={{ top: stickyTop }}
            >
                <div role="row" className={ROW}>
                    <div role="columnheader" className={cn(PINNED, "p-3 text-sm")}>
                        {corner}
                    </div>
                    {columns.map((column) => (
                        <div
                            key={column.id}
                            role="columnheader"
                            data-column={column.id}
                            className={cn(CELL, "py-3 text-left text-sm font-normal")}
                        >
                            {column.header}
                        </div>
                    ))}
                </div>
            </div>
            <div
                ref={body}
                role="rowgroup"
                data-slot="compare-table-body"
                onScroll={onBodyScroll}
                className={SCROLLER}
            >
                {shown.map((section, index) => (
                    <Fragment key={section.id}>
                        {section.title !== undefined && (
                            <div
                                role="row"
                                data-slot="compare-table-section"
                                className="min-w-(--compare-min) border-b bg-secondary"
                            >
                                <div
                                    role="rowheader"
                                    aria-colspan={count + 1}
                                    className="sticky left-0 w-fit px-3 py-1.5 text-sm font-semibold text-foreground"
                                >
                                    {section.title}
                                </div>
                            </div>
                        )}
                        {section.rows.map((row, position) => (
                            <div
                                key={row.id}
                                role="row"
                                data-differs={row.differs || undefined}
                                className={cn(
                                    ROW,
                                    (index < shown.length - 1 ||
                                        position < section.rows.length - 1) &&
                                        "border-b",
                                )}
                            >
                                <div
                                    role="rowheader"
                                    className={cn(
                                        PINNED,
                                        "px-3 py-2 text-sm",
                                        row.differs
                                            ? "font-medium text-foreground"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        data-slot="compare-table-marker"
                                        className={cn(
                                            "mr-2 inline-block size-1.5 rounded-full align-middle",
                                            row.differs ? "bg-primary" : "bg-transparent",
                                        )}
                                    />
                                    {row.label}
                                    {row.differs && (
                                        <span className="sr-only">{` (${differsLabel})`}</span>
                                    )}
                                </div>
                                {columns.map((column, cell) => (
                                    <div
                                        key={column.id}
                                        role="cell"
                                        className={cn(CELL, "py-2 text-sm tabular-nums")}
                                    >
                                        {row.cells[cell]}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

function CompareMarker({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn("inline-block size-1.5 shrink-0 rounded-full bg-primary", className)}
        />
    );
}

export { CompareMarker, CompareTable };
