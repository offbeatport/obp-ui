"use client";

import {
    type Announcements,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    KeyboardSensor,
    type Modifier,
    MouseSensor,
    TouchSensor,
    type UniqueIdentifier,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    horizontalListSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import { GripHorizontal } from "lucide-react";
import {
    type CSSProperties,
    Fragment,
    type ReactNode,
    type RefObject,
    type UIEvent,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

export type CompareColumn = {
    id: string;
    header: ReactNode;
    label?: string;
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
    onReorder?: (ids: string[]) => void;
    className?: string;
};

type Side = "head" | "body";

type Drag = { active: string; over: string | null };

const SURFACE = "bg-(--compare-surface,var(--background))";
const DIFFERS_TINT =
    "[--compare-differs:color-mix(in_srgb,var(--primary)_6%,var(--compare-surface,var(--background)))] dark:[--compare-differs:color-mix(in_srgb,var(--primary)_12%,var(--compare-surface,var(--background)))]";
const ROW = "grid min-w-(--compare-min) grid-cols-(--compare-columns)";
const PINNED = "sticky left-0 z-[1] min-w-0 border-r";
const CELL = "min-w-0 border-r px-3 last:border-r-0";
const DIFFERS_EDGE =
    "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary";
const SCROLLER =
    "overflow-x-auto overscroll-x-contain [scroll-padding-inline-start:var(--compare-label)]";
const HEADER_CELL = cn(CELL, "relative py-3 text-left text-sm font-normal");

const INSTRUCTIONS = {
    draggable:
        "To reorder, press Space to pick up the column, the left and right arrow keys to move it and Space to drop it. Press Escape to cancel.",
};

const alongRow: Modifier = ({ transform }) => ({ ...transform, y: 0 });

const overlayTransition = (event: Event | null) =>
    event instanceof KeyboardEvent ? "transform 120ms ease-out" : undefined;

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

function announcements(columns: CompareColumn[], moved: { current: boolean }): Announcements {
    const name = (id: UniqueIdentifier) =>
        columns.find((column) => column.id === id)?.label ?? String(id);
    const position = (id: UniqueIdentifier) =>
        `position ${columns.findIndex((column) => column.id === id) + 1} of ${columns.length}`;
    return {
        onDragStart: ({ active }) => {
            moved.current = false;
            return `Picked up ${name(active.id)}, ${position(active.id)}.`;
        },
        onDragOver: ({ active, over }) => {
            if (over?.id === active.id && !moved.current) {
                return undefined;
            }
            moved.current = true;
            return over
                ? `${name(active.id)} moved to ${position(over.id)}.`
                : `${name(active.id)} is outside the columns.`;
        },
        onDragEnd: ({ active, over }) =>
            over
                ? `${name(active.id)} dropped at ${position(over.id)}.`
                : `${name(active.id)} returned to ${position(active.id)}.`,
        onDragCancel: ({ active }) =>
            `Reorder cancelled. ${name(active.id)} returned to ${position(active.id)}.`,
    };
}

function dropSlot(ids: string[], drag: Drag | null): number | undefined {
    if (!drag?.over || drag.over === drag.active) {
        return undefined;
    }
    const from = ids.indexOf(drag.active);
    const to = ids.indexOf(drag.over);
    if (from < 0 || to < 0) {
        return undefined;
    }
    return to > from ? to + 1 : to;
}

function DropLine({ slot, count }: { slot: number | undefined; count: number }) {
    if (slot === undefined) {
        return null;
    }
    return (
        <div
            aria-hidden="true"
            data-slot="compare-table-drop"
            className={cn(ROW, "pointer-events-none absolute inset-y-0 left-0 w-full")}
        >
            <div
                className={cn(
                    "row-start-1 w-0.5 bg-primary",
                    slot === count ? "justify-self-end" : "justify-self-start",
                    slot > 0 && slot < count && "-translate-x-1/2",
                )}
                style={{ gridColumnStart: Math.min(slot, count - 1) + 2 }}
            />
        </div>
    );
}

function SortableHeader({ column, dragging }: { column: CompareColumn; dragging: boolean }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({
        id: column.id,
    });
    const [tip, setTip] = useState(false);
    return (
        <div
            ref={setNodeRef}
            role="columnheader"
            data-column={column.id}
            className={cn(
                HEADER_CELL,
                "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none]",
            )}
            {...listeners}
        >
            <Tooltip open={tip && !dragging} onOpenChange={setTip}>
                <TooltipTrigger
                    ref={setActivatorNodeRef}
                    {...attributes}
                    aria-label={`Reorder ${column.label ?? column.id}`}
                    data-slot="compare-table-grip"
                    data-column={column.id}
                    className="absolute top-0 left-1/2 flex h-3 w-8 -translate-x-1/2 cursor-grab items-center justify-center rounded-md text-faint outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <GripHorizontal aria-hidden="true" className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Drag to reorder</TooltipContent>
            </Tooltip>
            <div className={cn("h-full", dragging && "opacity-50")}>{column.header}</div>
        </div>
    );
}

function DragPreview({ column }: { column: CompareColumn | undefined }) {
    return createPortal(
        <DragOverlay
            dropAnimation={null}
            modifiers={[alongRow]}
            transition={overlayTransition}
            className="motion-reduce:transition-none!"
        >
            {column && (
                <div
                    data-slot="compare-table-preview"
                    className="h-full cursor-grabbing rounded-lg border bg-popover px-3 py-3 text-sm text-popover-foreground shadow-e2"
                >
                    <div inert className="h-full">
                        {column.header}
                    </div>
                </div>
            )}
        </DragOverlay>,
        document.body,
    );
}

function Reorderable({
    columns,
    head,
    onReorder,
    children,
}: {
    columns: CompareColumn[];
    head: RefObject<HTMLDivElement | null>;
    onReorder: (ids: string[]) => void;
    children: (drag: Drag | null) => ReactNode;
}) {
    const id = useId();
    const [drag, setDrag] = useState<Drag | null>(null);
    const refocus = useRef<{ id: string; from: string } | null>(null);
    const moved = useRef(false);
    const ids = columns.map((column) => column.id);
    const order = ids.join(",");
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
            scrollBehavior: "auto",
        }),
    );
    useEffect(() => {
        const pending = refocus.current;
        if (!pending || pending.from === order) {
            return;
        }
        refocus.current = null;
        const grip = head.current?.querySelector<HTMLElement>(
            `[data-slot="compare-table-grip"][data-column="${CSS.escape(pending.id)}"]`,
        );
        if (grip && document.activeElement !== grip) {
            grip.focus();
        }
    }, [order, head]);
    const start = ({ active }: DragStartEvent) => {
        refocus.current = null;
        setDrag({ active: String(active.id), over: String(active.id) });
    };
    const over = ({ active, over }: DragOverEvent) =>
        setDrag({ active: String(active.id), over: over ? String(over.id) : null });
    const end = ({ active, over, activatorEvent }: DragEndEvent) => {
        setDrag(null);
        const from = ids.indexOf(String(active.id));
        const to = over ? ids.indexOf(String(over.id)) : -1;
        if (from < 0 || to < 0 || from === to) {
            return;
        }
        if (activatorEvent instanceof KeyboardEvent) {
            refocus.current = { id: String(active.id), from: order };
        }
        onReorder(arrayMove(ids, from, to));
    };
    return (
        <DndContext
            id={id}
            sensors={sensors}
            collisionDetection={closestCenter}
            autoScroll={{
                threshold: { x: 0.15, y: 0 },
                acceleration: 12,
                canScroll: (element) => element === head.current,
            }}
            accessibility={{
                announcements: announcements(columns, moved),
                screenReaderInstructions: INSTRUCTIONS,
            }}
            onDragStart={start}
            onDragOver={over}
            onDragEnd={end}
            onDragCancel={() => setDrag(null)}
        >
            <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
                {children(drag)}
            </SortableContext>
            {drag && <DragPreview column={columns.find((column) => column.id === drag.active)} />}
        </DndContext>
    );
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
    onReorder,
    className,
}: CompareTableProps) {
    const { head, body, onHeadScroll, onBodyScroll } = useLinkedScroll();
    const count = columns.length;
    const ids = columns.map((column) => column.id);
    const style = {
        "--compare-label": labelWidth,
        "--compare-column": columnWidth,
        "--compare-columns": `var(--compare-label) repeat(${count}, minmax(var(--compare-column), 1fr))`,
        "--compare-min": `calc(var(--compare-label) + ${count} * var(--compare-column))`,
    } as CSSProperties;
    const shown = sections.filter((section) => section.rows.length > 0);
    const reorderable = Boolean(onReorder) && count > 1;
    const table = (drag: Drag | null) => {
        const slot = dropSlot(ids, drag);
        return (
            <div
                role="table"
                aria-label={label}
                aria-colcount={count + 1}
                data-slot="compare-table"
                className={cn(
                    "@container relative overflow-clip rounded-md border",
                    SURFACE,
                    DIFFERS_TINT,
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
                        <div role="columnheader" className={cn(PINNED, SURFACE, "p-3 text-sm")}>
                            {corner}
                        </div>
                        {columns.map((column) =>
                            reorderable ? (
                                <SortableHeader
                                    key={column.id}
                                    column={column}
                                    dragging={drag?.active === column.id}
                                />
                            ) : (
                                <div
                                    key={column.id}
                                    role="columnheader"
                                    data-column={column.id}
                                    className={HEADER_CELL}
                                >
                                    {column.header}
                                </div>
                            ),
                        )}
                    </div>
                    <DropLine slot={slot} count={count} />
                </div>
                <div
                    ref={body}
                    role="rowgroup"
                    data-slot="compare-table-body"
                    onScroll={onBodyScroll}
                    className={cn("relative", SCROLLER)}
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
                                                ? cn(
                                                      "bg-(--compare-differs) font-medium text-foreground",
                                                      DIFFERS_EDGE,
                                                  )
                                                : cn(SURFACE, "text-muted-foreground"),
                                        )}
                                    >
                                        {row.label}
                                        {row.differs && (
                                            <span className="sr-only">{` (${differsLabel})`}</span>
                                        )}
                                    </div>
                                    {columns.map((column, cell) => (
                                        <div
                                            key={column.id}
                                            role="cell"
                                            className={cn(
                                                CELL,
                                                "py-2 text-sm tabular-nums",
                                                row.differs
                                                    ? "bg-(--compare-differs) text-foreground"
                                                    : "text-muted-foreground",
                                                drag?.active === column.id && "opacity-50",
                                            )}
                                        >
                                            {row.cells[cell]}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </Fragment>
                    ))}
                    <DropLine slot={slot} count={count} />
                </div>
            </div>
        );
    };
    if (!onReorder || !reorderable) {
        return table(null);
    }
    return (
        <Reorderable columns={columns} head={head} onReorder={onReorder}>
            {table}
        </Reorderable>
    );
}

function CompareMarker({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            data-slot="compare-marker"
            className={cn(
                "inline-block h-3.5 w-2.5 shrink-0 border-l-2 border-primary bg-[var(--compare-differs,color-mix(in_srgb,var(--primary)_8%,transparent))]",
                className,
            )}
        />
    );
}

export { CompareMarker, CompareTable };
