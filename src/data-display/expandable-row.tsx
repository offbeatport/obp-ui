"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type ExpandableRowListProps = {
    children: ReactNode;
    className?: string;
};

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
                    "bg-primary/[0.05] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary before:content-['']",
                className,
            )}
            data-row={dataRow}
        >
            <div className="flex items-stretch">
                <button
                    className={cn(
                        "flex-1 min-w-0 flex items-center gap-[13px] py-[14px] px-[16px] bg-transparent border-none cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:[outline-offset:-2px]",
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
