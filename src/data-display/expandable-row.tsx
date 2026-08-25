"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// The expanding list row - chrome only. Lifted from the spin flow's ranked-opportunity list
// (apps/web/src/components/spin-views.tsx): a framed list of hairline-separated rows, each a
// big click target with a chevron gutter that toggles a panel underneath.
//
// Nothing in here knows about opportunities: the row body and the panel body are slots, and the
// caller owns `open` (rows are usually mutually exclusive, which is a parent's decision).

export type ExpandableRowListProps = {
    children: ReactNode;
    className?: string;
};

// The frame. `overflow-hidden` is what clips the first/last row's corners to the 12px radius.
export function ExpandableRowList({ children, className }: ExpandableRowListProps) {
    return (
        <div
            className={cn(
                "border border-border rounded-[12px] bg-card shadow-e1 overflow-hidden",
                className,
            )}
        >
            {children}
        </div>
    );
}

export type ExpandableRowProps = {
    /** Panel visibility - controlled, so the parent can keep one row open at a time. */
    open: boolean;
    onToggle: () => void;
    /** Marked row: primary left rail + a faint primary wash. The row stays fully visible. */
    selected?: boolean;
    /** Clicking the row body (not the chevron) - the "pick this one" action. */
    onSelect?: () => void;
    /** Blocks the row body while a mutation is in flight. The chevron stays live. */
    disabled?: boolean;
    /** Native tooltip on the row body, e.g. "Pick this opportunity". */
    title?: string;
    /** Accessible name for the chevron, e.g. "Show the score breakdown". */
    toggleLabel?: string;
    /** Written through to `data-row` - handy for scroll-into-view by id. */
    dataRow?: string;
    /** The row body: lives inside the button, so pass <span>s, not <div>s. */
    children: ReactNode;
    /** The expanded panel body. */
    panel?: ReactNode;
    className?: string;
    /** Merged onto the panel's inner surface (the padded, column-flex card). */
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
                // Picked line: marked with a primary left rail + faint primary
                // tint (never hidden - the whole list stays visible).
                selected &&
                    "bg-primary/[0.05] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary before:content-['']",
                className,
            )}
            data-row={dataRow}
        >
            <div className="flex items-stretch">
                <button
                    className={cn(
                        "flex-1 min-w-0 flex items-center gap-[13px] py-[14px] px-[16px] bg-transparent border-none cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:[outline-offset:-2px]",
                        // Open wins over picked: the open row is the one being read.
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
                        "shrink-0 w-[54px] self-stretch border-none bg-transparent grid place-items-center cursor-pointer hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                        open ? "rotate-180 text-primary" : "text-faint",
                    )}
                    type="button"
                    aria-label={toggleLabel}
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    {/* Inline chevron rather than the lucide icon: this one is 21px at 2.2
                        stroke, which is not a size lucide's defaults land on. */}
                    <svg
                        className="w-[21px] h-[21px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>
            </div>
            {panel !== undefined && (
                // hidden (not unmounted) so the panel's own state survives a collapse.
                <div className={cn(open ? "block" : "hidden", "pt-[2px] px-[16px] pb-[16px]")}>
                    <div
                        className={cn(
                            "font-sans w-full bg-card text-foreground py-[15px] px-[17px] flex flex-col gap-[12px]",
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
