"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type ExpandableRowListProps = {
    children: ReactNode;
    className?: string;
};

export function ExpandableRowList({ children, className }: ExpandableRowListProps) {
    return (
        <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
            {children}
        </div>
    );
}

export type ExpandableRowProps = {
    open: boolean;
    onToggle: () => void;
    selected?: boolean;
    onSelect?: () => void;
    disabled?: boolean;
    title?: string;
    toggleLabel?: string;
    dataRow?: string;
    children: ReactNode;
    panel?: ReactNode;
    className?: string;
    panelClassName?: string;
};

export function ExpandableRow({
    open,
    onToggle,
    selected,
    onSelect,
    disabled,
    title,
    toggleLabel = "Toggle details",
    dataRow,
    children,
    panel,
    className,
    panelClassName,
}: ExpandableRowProps) {
    return (
        <div
            className={cn(
                "relative border-t border-border-soft first:border-t-0",
                selected &&
                    "bg-accent/50 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']",
                className,
            )}
            data-row={dataRow}
        >
            <div className="flex items-stretch">
                <button
                    className={cn(
                        "flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                        open ? "bg-secondary" : selected ? "bg-transparent" : "hover:bg-secondary",
                    )}
                    type="button"
                    title={title}
                    disabled={disabled}
                    onClick={onSelect}
                >
                    {children}
                </button>
                <button
                    className={cn(
                        "grid w-10 shrink-0 cursor-pointer place-items-center self-stretch border-none bg-transparent hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                        open ? "rotate-180 text-foreground" : "text-faint",
                    )}
                    type="button"
                    aria-label={toggleLabel}
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>
            </div>
            {panel !== undefined && (
                <div className={cn(open ? "block" : "hidden", "border-t border-border-soft")}>
                    <div
                        className={cn(
                            "flex w-full flex-col gap-3 bg-card p-3 font-sans text-foreground",
                            panelClassName,
                        )}
                    >
                        {panel}
                    </div>
                </div>
            )}
        </div>
    );
}
