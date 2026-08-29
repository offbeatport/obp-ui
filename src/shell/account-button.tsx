"use client";

import { ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { useRailCollapsed } from "./rail-context";

export type AccountButtonProps = Omit<ComponentProps<"button">, "name" | "children"> & {
    initial?: ReactNode;
    name?: ReactNode;
    sub?: ReactNode;
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
