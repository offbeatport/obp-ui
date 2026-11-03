"use client";

import { ChevronRight } from "lucide-react";
import {
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { cn } from "../lib/cn";

export type TreeNode = {
    id: string;
    label: ReactNode;
    textValue?: string;
    icon?: ReactNode;
    meta?: ReactNode;
    children?: TreeNode[];
};

export type TreeProps = {
    nodes: TreeNode[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    expandedIds?: string[];
    defaultExpandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    empty?: ReactNode;
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

const TYPEAHEAD_MS = 600;

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

export function Tree({
    nodes,
    selectedId = null,
    onSelect,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    empty,
    className,
    ...labelling
}: TreeProps) {
    const [innerExpanded, setInnerExpanded] = useState<string[]>(defaultExpandedIds ?? []);
    const expandedList = expandedIds ?? innerExpanded;
    const expanded = useMemo(() => new Set(expandedList), [expandedList]);
    const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
    const [focusedId, setFocusedId] = useState<string | null>(selectedId);
    const elements = useRef(new Map<string, HTMLDivElement>());
    const typed = useRef({ text: "", at: 0 });

    const setExpanded = useCallback(
        (next: string[]) => {
            if (expandedIds === undefined) {
                setInnerExpanded(next);
            }
            onExpandedChange?.(next);
        },
        [expandedIds, onExpandedChange],
    );

    useEffect(() => {
        if (selectedId) {
            setFocusedId(selectedId);
            elements.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedId]);

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

    if (rows.length === 0) {
        return empty ? <div className={className}>{empty}</div> : null;
    }

    return (
        <div
            role="tree"
            data-slot="tree"
            className={cn("flex flex-col gap-px p-1", className)}
            {...labelling}
        >
            {rows.map((row, index) => {
                const selected = row.node.id === selectedId;
                return (
                    <div
                        key={row.node.id}
                        ref={(element) => {
                            if (element) {
                                elements.current.set(row.node.id, element);
                            } else {
                                elements.current.delete(row.node.id);
                            }
                        }}
                        role="treeitem"
                        data-slot="tree-item"
                        aria-level={row.level}
                        aria-posinset={row.position}
                        aria-setsize={row.siblings}
                        aria-expanded={row.expandable ? row.expanded : undefined}
                        aria-selected={selected}
                        tabIndex={row.node.id === tabStop ? 0 : -1}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        onClick={(event) => onClick(event, row)}
                        onFocus={() => setFocusedId(row.node.id)}
                        className={cn(
                            "flex h-8 shrink-0 cursor-default items-center gap-1.5 rounded-md pr-2 text-sm select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                            selected
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground hover:bg-secondary",
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
                        <span className="min-w-0 flex-1 truncate">{row.node.label}</span>
                        {row.node.meta !== undefined && (
                            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                {row.node.meta}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
