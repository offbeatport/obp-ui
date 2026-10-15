"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { useRailCollapsed } from "./rail-context";

export type SectionLabelProps = {
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
            className={cn("px-2 pt-4 pb-1.5 text-sm font-medium text-muted-foreground", className)}
        >
            {children}
        </div>
    );
}
