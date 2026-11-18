"use client";

import { IconChevronUp } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { railFade, useRailCollapsed } from "./rail-context";

export type AccountButtonProps = Omit<ComponentProps<"button">, "name" | "children"> & {
    initial?: ReactNode;
    name?: ReactNode;
    sub?: ReactNode;
    collapsed?: boolean;
    tone?: "primary" | "muted";
};

const TONES = {
    primary: "bg-primary text-primary-foreground",
    muted: "border border-border bg-secondary text-muted-foreground",
};

export function AccountButton({
    initial,
    name,
    sub,
    collapsed: collapsedProp,
    tone = "primary",
    className,
    ...props
}: AccountButtonProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;
    return (
        <button
            type="button"
            className={cn(
                "mt-2 flex h-12 w-full items-center gap-2.5 overflow-hidden rounded-md px-1.5 text-left hover:bg-secondary hover:text-foreground",
                className,
            )}
            {...props}
        >
            <span
                className={cn(
                    "grid size-8 flex-none place-items-center rounded-[9px] text-sm font-bold",
                    TONES[tone],
                )}
            >
                {initial}
            </span>
            <span className={cn("min-w-0 flex-1", railFade(collapsed))}>
                <span className="block truncate text-base font-semibold">{name}</span>
                <span className="block truncate text-sm text-faint">{sub}</span>
            </span>
            <IconChevronUp className={cn("size-4 flex-none text-faint", railFade(collapsed))} />
        </button>
    );
}
