"use client";

import {
    type Announcements,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type Modifier,
    MouseSensor,
    TouchSensor,
    type UniqueIdentifier,
    pointerWithin,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { ChevronRight, Ellipsis } from "lucide-react";
import {
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    type RefObject,
    type SyntheticEvent,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

export type TreeNode = {
    id: string;
    label: ReactNode;
    textValue?: string;
    icon?: ReactNode;
    meta?: ReactNode;
    children?: TreeNode[];
    draggable?: boolean;
    droppable?: boolean;
};

export type TreeProps = {
    nodes: TreeNode[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    expandedIds?: string[];
    defaultExpandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    empty?: ReactNode;
    onMove?: (id: string, targetId: string) => void;
    canDrop?: (node: TreeNode, target: TreeNode) => boolean;
    rowActions?: (node: TreeNode) => ReactNode;
    className?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
};

type VisibleRow = {
    node: TreeNode;
    level: number;
    parentId: string | null;
    position: number;
    siblings: number;
    expandable: boolean;
    expanded: boolean;
};

type Placement = { node: TreeNode; parentId: string | null };

type Drag = { active: string; over: string | null; target: string | null };

type RowActionsState = {
    tabbable: boolean;
    row: RefObject<HTMLDivElement | null>;
    opener: RefObject<(() => void) | null>;
};

const RowActionsContext = createContext<RowActionsState | null>(null);

const ROW_ACTIONS = cn(
    "flex shrink-0 items-center opacity-0",
    "group-hover/tree-row:opacity-100 group-focus-visible/tree-row:opacity-100 focus-within:opacity-100",
    "has-aria-expanded:opacity-100 [@media(hover:none)]:opacity-100",
);

const TYPEAHEAD_MS = 600;
const SPRING_OPEN_MS = 700;
const PREVIEW_OFFSET = 12;
const INSTRUCTIONS = {
    draggable: "Drag with a mouse, or press and hold on a touch screen, then drop onto a folder.",
};

function hasChildren(node: TreeNode): boolean {
    return (node.children?.length ?? 0) > 0;
}

function visibleRows(
    nodes: TreeNode[],
    expanded: Set<string>,
    level = 1,
    parentId: string | null = null,
    out: VisibleRow[] = [],
): VisibleRow[] {
    nodes.forEach((node, index) => {
        const expandable = hasChildren(node);
        const open = expandable && expanded.has(node.id);
        out.push({
            node,
            level,
            parentId,
            position: index + 1,
            siblings: nodes.length,
            expandable,
            expanded: open,
        });
        if (open && node.children) {
            visibleRows(node.children, expanded, level + 1, node.id, out);
        }
    });
    return out;
}

function textOf(node: TreeNode): string {
    if (node.textValue !== undefined) {
        return node.textValue;
    }
    return typeof node.label === "string" ? node.label : node.id;
}

function isPrintable(event: KeyboardEvent): boolean {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function filterTree(
    nodes: TreeNode[],
    matches: (node: TreeNode) => boolean,
): { nodes: TreeNode[]; expandedIds: string[] } {
    const expandedIds: string[] = [];
    const walk = (list: TreeNode[]): TreeNode[] =>
        list.flatMap((node) => {
            const children = walk(node.children ?? []);
            if (children.length > 0) {
                expandedIds.push(node.id);
            }
            if (matches(node)) {
                return [node];
            }
            return children.length > 0 ? [{ ...node, children }] : [];
        });
    return { nodes: walk(nodes), expandedIds };
}

function indexTree(
    nodes: TreeNode[],
    parentId: string | null = null,
    out = new Map<string, Placement>(),
): Map<string, Placement> {
    for (const node of nodes) {
        out.set(node.id, { node, parentId });
        indexTree(node.children ?? [], node.id, out);
    }
    return out;
}

function isWithin(index: Map<string, Placement>, id: string, ancestorId: string): boolean {
    for (let at: string | null = id; at !== null; at = index.get(at)?.parentId ?? null) {
        if (at === ancestorId) {
            return true;
        }
    }
    return false;
}

function droppableAt(index: Map<string, Placement>, id: string): Placement | undefined {
    let at = index.get(id);
    while (at && !at.node.droppable) {
        at = at.parentId === null ? undefined : index.get(at.parentId);
    }
    return at;
}

function dropTarget(
    index: Map<string, Placement>,
    activeId: string,
    overId: string | null,
    canDrop: TreeProps["canDrop"],
): string | null {
    const active = index.get(activeId);
    const target = overId === null ? undefined : droppableAt(index, overId);
    if (!active || !target) {
        return null;
    }
    const id = target.node.id;
    if (active.parentId === id || isWithin(index, id, activeId)) {
        return null;
    }
    return canDrop && !canDrop(active.node, target.node) ? null : id;
}

function announcements(
    index: Map<string, Placement>,
    targetOf: (active: UniqueIdentifier, over: UniqueIdentifier | undefined) => string | null,
): Announcements {
    const name = (id: UniqueIdentifier) => {
        const node = index.get(String(id))?.node;
        return node ? textOf(node) : String(id);
    };
    return {
        onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
        onDragOver: ({ active, over }) => {
            const target = targetOf(active.id, over?.id);
            return target
                ? `${name(active.id)} is over ${name(target)}.`
                : `${name(active.id)} cannot be dropped here.`;
        },
        onDragEnd: ({ active, over }) => {
            const target = targetOf(active.id, over?.id);
            return target
                ? `${name(active.id)} moved into ${name(target)}.`
                : `${name(active.id)} was not moved.`;
        },
        onDragCancel: ({ active }) => `Move cancelled. ${name(active.id)} was not moved.`,
    };
}

export function ancestorsOf(nodes: TreeNode[], id: string): string[] {
    for (const node of nodes) {
        if (node.id === id) {
            return [];
        }
        const below = ancestorsOf(node.children ?? [], id);
        if (below.length > 0 || node.children?.some((child) => child.id === id)) {
            return [node.id, ...below];
        }
    }
    return [];
}

function isMenuKey(event: KeyboardEvent): boolean {
    return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function focusMovedOn(): boolean {
    const active = document.activeElement;
    return (
        active instanceof HTMLElement &&
        active !== document.body &&
        active.closest('[data-slot="dropdown-menu-content"]') === null
    );
}

function keepInSlot(event: SyntheticEvent) {
    event.stopPropagation();
}

export function TreeRowMenu({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    const state = useContext(RowActionsContext);
    const [open, setOpen] = useState(false);
    const fromRow = useRef(false);
    useEffect(() => {
        if (!state) {
            return;
        }
        state.opener.current = () => {
            fromRow.current = true;
            setOpen(true);
        };
        return () => {
            state.opener.current = null;
        };
    }, [state]);
    const onOpenChange = (next: boolean) => {
        if (next) {
            fromRow.current = false;
        }
        setOpen(next);
    };
    return (
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            data-slot="tree-row-menu-trigger"
                            aria-label={label}
                            tabIndex={state?.tabbable === false ? -1 : 0}
                            className={cn(
                                "text-muted-foreground hover:bg-border-soft hover:text-foreground aria-expanded:bg-border-soft aria-expanded:text-foreground",
                                className,
                            )}
                        >
                            <Ellipsis className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
                align="end"
                className="min-w-44"
                finalFocus={() => {
                    if (focusMovedOn()) {
                        return false;
                    }
                    return fromRow.current ? (state?.row.current ?? true) : true;
                }}
            >
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

type TreeRowProps = {
    row: VisibleRow;
    selected: boolean;
    tabbable: boolean;
    movable: boolean;
    lifted: boolean;
    target: boolean;
    actions: ReactNode;
    labelId: string;
    metaId: string;
    register: (id: string, element: HTMLDivElement | null) => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
    onClick: (event: MouseEvent<HTMLDivElement>) => void;
    onFocus: () => void;
};

function TreeRow({
    row,
    selected,
    tabbable,
    movable,
    lifted,
    target,
    actions,
    labelId,
    metaId,
    register,
    onKeyDown,
    onClick,
    onFocus,
}: TreeRowProps) {
    const id = row.node.id;
    const draggable = Boolean(movable && row.node.draggable);
    const drag = useDraggable({ id, disabled: !draggable });
    const drop = useDroppable({ id, disabled: !movable });
    const setDragNode = drag.setNodeRef;
    const setDropNode = drop.setNodeRef;
    const element = useRef<HTMLDivElement | null>(null);
    const opener = useRef<(() => void) | null>(null);
    const hasMeta = row.node.meta !== undefined;
    const hasActions = actions !== null && actions !== undefined && actions !== false;
    const slot = useMemo(() => ({ tabbable, row: element, opener }), [tabbable]);
    const ref = useCallback(
        (node: HTMLDivElement | null) => {
            element.current = node;
            register(id, node);
            setDragNode(node);
            setDropNode(node);
        },
        [id, register, setDragNode, setDropNode],
    );
    const openMenu = () => {
        if (!opener.current) {
            return false;
        }
        opener.current();
        return true;
    };
    return (
        <div
            ref={ref}
            role="treeitem"
            data-slot="tree-item"
            data-drop-target={target ? "" : undefined}
            aria-labelledby={hasMeta ? `${labelId} ${metaId}` : labelId}
            aria-level={row.level}
            aria-posinset={row.position}
            aria-setsize={row.siblings}
            aria-expanded={row.expandable ? row.expanded : undefined}
            aria-selected={selected}
            tabIndex={tabbable ? 0 : -1}
            {...drag.listeners}
            onKeyDown={(event) => {
                if (isMenuKey(event) && openMenu()) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                onKeyDown(event);
            }}
            onContextMenu={(event) => {
                if (openMenu()) {
                    event.preventDefault();
                }
            }}
            onClick={onClick}
            onFocus={onFocus}
            className={cn(
                "group/tree-row flex h-8 shrink-0 cursor-default items-center gap-1.5 rounded-md text-sm select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                hasActions ? "pr-1" : "pr-2",
                selected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-secondary",
                draggable && "touch-manipulation [-webkit-touch-callout:none]",
                lifted && "opacity-50",
                target && "outline-1 -outline-offset-1 outline-primary",
                target && !selected && "bg-secondary",
            )}
            style={{
                paddingInlineStart: `calc(var(--spacing) * ${row.level * 4 - 3})`,
            }}
        >
            <span
                data-tree-toggle={row.expandable ? "" : undefined}
                aria-hidden="true"
                className="grid size-4 shrink-0 place-items-center text-muted-foreground"
            >
                {row.expandable && (
                    <ChevronRight
                        className={cn(
                            "size-4 transition-transform duration-100 motion-reduce:transition-none",
                            row.expanded && "rotate-90",
                        )}
                    />
                )}
            </span>
            {row.node.icon && (
                <span
                    aria-hidden="true"
                    className={cn(
                        "grid shrink-0 place-items-center [&>svg]:size-4",
                        selected ? "text-accent-foreground" : "text-muted-foreground",
                    )}
                >
                    {row.node.icon}
                </span>
            )}
            <span id={labelId} className="min-w-0 flex-1 truncate">
                {row.node.label}
            </span>
            {hasMeta && (
                <span id={metaId} className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {row.node.meta}
                </span>
            )}
            {hasActions && (
                <RowActionsContext.Provider value={slot}>
                    <span
                        data-slot="tree-row-actions"
                        className={ROW_ACTIONS}
                        onClick={keepInSlot}
                        onDoubleClick={keepInSlot}
                        onKeyDown={keepInSlot}
                        onMouseDown={keepInSlot}
                        onTouchStart={keepInSlot}
                        onContextMenu={keepInSlot}
                    >
                        {actions}
                    </span>
                </RowActionsContext.Provider>
            )}
        </div>
    );
}

function pointOf(event: Event | null): { x: number; y: number } | null {
    if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
        const touch = event.touches[0] ?? event.changedTouches[0];
        return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }
    return event instanceof globalThis.MouseEvent ? { x: event.clientX, y: event.clientY } : null;
}

const besidePointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
    const point = pointOf(activatorEvent);
    if (!point || !draggingNodeRect) {
        return transform;
    }
    return {
        ...transform,
        x: transform.x + point.x - draggingNodeRect.left + PREVIEW_OFFSET,
        y: transform.y + point.y - draggingNodeRect.top + PREVIEW_OFFSET,
    };
};

function DragPreview({ node }: { node: TreeNode | undefined }) {
    return createPortal(
        <DragOverlay
            dropAnimation={null}
            modifiers={[besidePointer]}
            className="motion-reduce:transition-none!"
        >
            {node && (
                <div
                    data-slot="tree-drag-preview"
                    className="flex h-8 w-max max-w-72 cursor-grabbing items-center gap-1.5 rounded-md border bg-popover px-2 text-sm text-popover-foreground shadow-e2"
                >
                    {node.icon && (
                        <span
                            aria-hidden="true"
                            className="grid shrink-0 place-items-center text-muted-foreground [&>svg]:size-4"
                        >
                            {node.icon}
                        </span>
                    )}
                    <span className="min-w-0 truncate">{node.label}</span>
                </div>
            )}
        </DragOverlay>,
        document.body,
    );
}

export function Tree({
    nodes,
    selectedId = null,
    onSelect,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    empty,
    onMove,
    canDrop,
    rowActions,
    className,
    ...labelling
}: TreeProps) {
    const contextId = useId();
    const [innerExpanded, setInnerExpanded] = useState<string[]>(defaultExpandedIds ?? []);
    const expandedList = expandedIds ?? innerExpanded;
    const expanded = useMemo(() => new Set(expandedList), [expandedList]);
    const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
    const index = useMemo(() => indexTree(nodes), [nodes]);
    const [focusedId, setFocusedId] = useState<string | null>(selectedId);
    const [drag, setDrag] = useState<Drag | null>(null);
    const elements = useRef(new Map<string, HTMLDivElement>());
    const typed = useRef({ text: "", at: 0 });
    const dropped = useRef(false);
    const movable = onMove !== undefined;
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    );

    const setExpanded = useCallback(
        (next: string[]) => {
            if (expandedIds === undefined) {
                setInnerExpanded(next);
            }
            onExpandedChange?.(next);
        },
        [expandedIds, onExpandedChange],
    );

    const register = useCallback((id: string, element: HTMLDivElement | null) => {
        if (element) {
            elements.current.set(id, element);
        } else {
            elements.current.delete(id);
        }
    }, []);

    useEffect(() => {
        if (selectedId) {
            setFocusedId(selectedId);
            elements.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedId]);

    const springId = drag?.over ?? null;
    const springActive = drag?.active ?? null;
    useEffect(() => {
        if (springId === null || springActive === null || expanded.has(springId)) {
            return;
        }
        const node = index.get(springId)?.node;
        if (!node || !hasChildren(node) || isWithin(index, springId, springActive)) {
            return;
        }
        const timer = window.setTimeout(
            () => setExpanded([...expandedList, springId]),
            SPRING_OPEN_MS,
        );
        return () => window.clearTimeout(timer);
    }, [springId, springActive, expanded, expandedList, index, setExpanded]);

    const tabStop =
        rows.find((row) => row.node.id === focusedId)?.node.id ??
        rows.find((row) => row.node.id === selectedId)?.node.id ??
        rows[0]?.node.id;

    const focus = (id: string | undefined) => {
        if (!id) {
            return;
        }
        setFocusedId(id);
        elements.current.get(id)?.focus();
    };

    const toggle = (row: VisibleRow, open = !row.expanded) => {
        if (!row.expandable || open === row.expanded) {
            return;
        }
        setExpanded(
            open ? [...expandedList, row.node.id] : expandedList.filter((id) => id !== row.node.id),
        );
    };

    const typeahead = (key: string, from: number) => {
        const moment = Date.now();
        const text = moment - typed.current.at > TYPEAHEAD_MS ? key : typed.current.text + key;
        typed.current = { text, at: moment };
        const needle = text.toLowerCase();
        const start = text.length === 1 ? from + 1 : from;
        const ordered = [...rows.slice(start), ...rows.slice(0, start)];
        const hit = ordered.find((row) => textOf(row.node).toLowerCase().startsWith(needle));
        focus(hit?.node.id);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
        const row = rows[index];
        if (!row) {
            return;
        }
        const handled = () => {
            event.preventDefault();
            event.stopPropagation();
        };
        switch (event.key) {
            case "ArrowDown":
                handled();
                focus(rows[index + 1]?.node.id);
                return;
            case "ArrowUp":
                handled();
                focus(rows[index - 1]?.node.id);
                return;
            case "ArrowRight":
                handled();
                if (row.expandable && !row.expanded) {
                    toggle(row, true);
                } else if (row.expanded) {
                    focus(rows[index + 1]?.node.id);
                }
                return;
            case "ArrowLeft":
                handled();
                if (row.expanded) {
                    toggle(row, false);
                } else if (row.parentId) {
                    focus(row.parentId);
                }
                return;
            case "Home":
                handled();
                focus(rows[0]?.node.id);
                return;
            case "End":
                handled();
                focus(rows[rows.length - 1]?.node.id);
                return;
            case "Enter":
            case " ":
                handled();
                onSelect?.(row.node.id);
                return;
            case "*": {
                handled();
                const siblings = rows
                    .filter((other) => other.parentId === row.parentId && other.expandable)
                    .map((other) => other.node.id);
                setExpanded([...new Set([...expandedList, ...siblings])]);
                return;
            }
            default:
                if (isPrintable(event)) {
                    handled();
                    typeahead(event.key, index);
                }
        }
    };

    const onClick = (event: MouseEvent<HTMLDivElement>, row: VisibleRow) => {
        if (dropped.current) {
            return;
        }
        setFocusedId(row.node.id);
        const onChevron = (event.target as HTMLElement).closest("[data-tree-toggle]");
        if (onChevron || row.node.id === selectedId) {
            toggle(row);
        } else if (!row.expanded) {
            toggle(row, true);
        }
        if (!onChevron) {
            onSelect?.(row.node.id);
        }
    };

    const targetOf = (active: UniqueIdentifier, over: UniqueIdentifier | null | undefined) =>
        dropTarget(
            index,
            String(active),
            over === null || over === undefined ? null : String(over),
            canDrop,
        );

    const settle = () => {
        setDrag(null);
        dropped.current = true;
        window.setTimeout(() => {
            dropped.current = false;
        }, 0);
    };

    const onDragStart = ({ active }: DragStartEvent) =>
        setDrag({ active: String(active.id), over: null, target: null });

    const onDragOver = ({ active, over }: DragOverEvent) =>
        setDrag({
            active: String(active.id),
            over: over ? String(over.id) : null,
            target: targetOf(active.id, over?.id),
        });

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        const target = targetOf(active.id, over?.id);
        settle();
        if (!target) {
            return;
        }
        if (!expanded.has(target)) {
            setExpanded([...expandedList, target]);
        }
        onMove?.(String(active.id), target);
    };

    if (rows.length === 0) {
        return empty ? <div className={className}>{empty}</div> : null;
    }

    const tree = (
        <div
            role="tree"
            data-slot="tree"
            className={cn("flex flex-col gap-px p-1", className)}
            {...labelling}
        >
            {rows.map((row, position) => (
                <TreeRow
                    key={row.node.id}
                    row={row}
                    selected={row.node.id === selectedId}
                    tabbable={row.node.id === tabStop}
                    movable={movable}
                    lifted={drag?.active === row.node.id}
                    target={drag?.target === row.node.id}
                    actions={rowActions?.(row.node)}
                    labelId={`${contextId}-label-${position}`}
                    metaId={`${contextId}-meta-${position}`}
                    register={register}
                    onKeyDown={(event) => onKeyDown(event, position)}
                    onClick={(event) => onClick(event, row)}
                    onFocus={() => setFocusedId(row.node.id)}
                />
            ))}
        </div>
    );

    if (!movable) {
        return tree;
    }

    return (
        <DndContext
            id={contextId}
            sensors={sensors}
            collisionDetection={pointerWithin}
            accessibility={{
                announcements: announcements(index, targetOf),
                screenReaderInstructions: INSTRUCTIONS,
            }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={settle}
        >
            {tree}
            {drag && <DragPreview node={index.get(drag.active)?.node} />}
        </DndContext>
    );
}
