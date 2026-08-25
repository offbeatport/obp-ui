"use client";

// A group heading inside the rail. When the rail is collapsed the text would be unreadable,
// so it degrades to a fixed 14px spacer - the groups stay visually separated at both widths.

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { useRailCollapsed } from "./rail-context";

export type SectionLabelProps = {
    /** Overrides the collapse context. */
    collapsed?: boolean;
    children: ReactNode;
    className?: string;
};

export function SectionLabel({ collapsed: collapsedProp, children, className }: SectionLabelProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;
    if (collapsed) return <div className="h-3.5" />;
    return (
        <div
            className={cn(
                "px-2 py-4 text-[11px] font-bold uppercase tracking-wide text-faint/70",
                className,
            )}
        >
            {children}
        </div>
    );
}
