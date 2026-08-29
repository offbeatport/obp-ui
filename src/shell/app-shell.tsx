"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { RailProvider, type RailState } from "./rail-context";

export type AppShellProps = {
    rail: ReactNode;
    children: ReactNode;
    console?: ReactNode;
    titleBar?: ReactNode;
    railWidth?: string;
    railCollapsedWidth?: string;
    defaultCollapsed?: boolean;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    className?: string;
    mainClassName?: string;
};

export function AppShell({
    rail,
    children,
    console: consoleSlot,
    titleBar,
    railWidth = "264px",
    railCollapsedWidth = "60px",
    defaultCollapsed = false,
    collapsed: collapsedProp,
    onCollapsedChange,
    className,
    mainClassName,
}: AppShellProps) {
    const [uncontrolled, setUncontrolled] = useState(defaultCollapsed);
    const collapsed = collapsedProp ?? uncontrolled;

    const setCollapsed = useCallback(
        (next: boolean) => {
            if (collapsedProp === undefined) setUncontrolled(next);
            onCollapsedChange?.(next);
        },
        [collapsedProp, onCollapsedChange],
    );

    const railState = useMemo<RailState>(
        () => ({ collapsed, setCollapsed, toggle: () => setCollapsed(!collapsed) }),
        [collapsed, setCollapsed],
    );

    const grid = (
        <div
            className={cn(
                "grid grid-rows-1 h-screen overflow-hidden transition-[grid-template-columns] duration-300",
                titleBar && "h-auto min-h-0 flex-1",
                className,
            )}
            style={{
                gridTemplateColumns: collapsed ? `${railCollapsedWidth} 1fr` : `${railWidth} 1fr`,
            }}
        >
            {rail}
            <main
                className={cn("flex min-w-0 flex-col overflow-y-auto bg-background", mainClassName)}
            >
                {children}
            </main>
        </div>
    );

    return (
        <RailProvider value={railState}>
            {titleBar ? (
                <div className="flex h-screen flex-col overflow-hidden">
                    {titleBar}
                    {grid}
                </div>
            ) : (
                grid
            )}
            {consoleSlot}
        </RailProvider>
    );
}
