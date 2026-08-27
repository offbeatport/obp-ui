"use client";

// The rail-foot account button: an initial tile, the name over a subtitle line, and the
// chevron that says "this opens something". Collapsed, only the tile survives.
//
// Presentational and ref-forwarding (React 19 passes `ref` as a plain prop), so it drops
// straight into <DropdownMenuTrigger asChild> - which is how <AccountMenu> uses it.

import { ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { useRailCollapsed } from "./rail-context";

export type AccountButtonProps = Omit<ComponentProps<"button">, "name" | "children"> & {
    /** The avatar tile's letter (or any small node). */
    initial?: ReactNode;
    /** Display name. */
    name?: ReactNode;
    /** The dim second line ("$120 MRR · 84 users"). */
    sub?: ReactNode;
    /** Overrides the collapse context. */
    collapsed?: boolean;
};

export function AccountButton({
    initial,
    name,
    sub,
    collapsed: collapsedProp,
    className,
    ...props
}: AccountButtonProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;
    return (
        <button
            type="button"
            className={cn(
                "mt-2 flex w-full items-center gap-2.5 rounded-md p-1 px-3 pb-2 text-left hover:bg-primary/[0.07] hover:text-foreground",
                collapsed && "justify-center",
                className,
            )}
            {...props}
        >
            <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary text-sm font-bold text-primary-foreground">
                {initial}
            </span>
            {!collapsed && (
                <>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{name}</span>
                        <span className="block truncate text-sm text-faint">{sub}</span>
                    </span>
                    <ChevronUp className="size-4 flex-none text-faint" />
                </>
            )}
        </button>
    );
}
