"use client";

// The application frame - left rail + main workspace - reproducing
// design/v2-prototypes/08-chat-spine-pro-v7.html. Follow that prototype for all shell work.
//
// Everything the frame holds is a slot: the rail, the workspace, an optional always-mounted
// overlay (`console`) and an optional desktop titlebar. The shell owns exactly one piece of
// state - whether the rail is collapsed - and publishes it on context (see rail-context) so
// the host's rail composition can read it without prop-drilling.

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { RailProvider, type RailState } from "./rail-context";

export type AppShellProps = {
    /** The left column - usually <Rail>. Rendered inside the collapse context. */
    rail: ReactNode;
    /** The workspace (the <main> column). */
    children: ReactNode;
    /**
     * A globally-mounted overlay (the agent console, a command palette). Deliberately kept
     * OUT of the grid so its root div can't take a grid cell.
     */
    console?: ReactNode;
    /**
     * Desktop only: a <TitleBar> above the frame. When present the shell becomes a column
     * (titlebar + grid) so the grid takes the remaining height instead of a full 100vh.
     */
    titleBar?: ReactNode;
    /** Expanded rail width. Any CSS length. */
    railWidth?: string;
    /** Collapsed rail width. Any CSS length. */
    railCollapsedWidth?: string;
    /** Uncontrolled initial state. */
    defaultCollapsed?: boolean;
    /** Controlled state - pass with `onCollapsedChange` to own it from outside. */
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
            // Controlled: the host owns the value, we only report the intent.
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
        // grid-rows-1 (minmax(0,1fr)) pins the single row to the viewport so the rail
        // and main each scroll internally instead of growing the page past 100vh.
        <div
            className={cn(
                "grid grid-rows-1 h-screen overflow-hidden transition-[grid-template-columns] duration-300",
                // With a titlebar the viewport height is spent by the column wrapper below,
                // so the grid claims what is left instead (tailwind-merge drops h-screen).
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
            {/* Global overlay - kept OUT of the grid so its root div can't take a grid cell. */}
            {consoleSlot}
        </RailProvider>
    );
}
