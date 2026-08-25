"use client";

// Minimise / maximise / close, for the platforms where the app draws its own buttons.
//
// Nothing native is imported here: every action comes from <WindowControlsProvider>. Two
// deliberate no-ops:
//   - no provider  → null (a browser tab has no window chrome to draw)
//   - macOS        → null (the OS paints the traffic lights over the titlebar; --titlebar-inset
//                    in desktop.css is what reserves room for them)

import { Minus, Square, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useWindowControls } from "./window-controls-context";

export type WindowControlsProps = {
    /** Render even on macOS (for a preview/gallery). */
    force?: boolean;
    className?: string;
    labels?: { minimize?: string; maximize?: string; restore?: string; close?: string };
};

// `.allow-transition` is desktop.css's documented opt-back-in: base.css pins hover
// transitions to 0s app-wide, and a window button is one of the few places where the fade
// genuinely helps (it makes the close button feel physical).
const BTN =
    "grid size-8 place-items-center rounded-md text-muted-foreground allow-transition transition-colors hover:bg-primary/[0.1] hover:text-foreground";

export function WindowControls({ force, className, labels }: WindowControlsProps) {
    const win = useWindowControls();
    if (!win) return null;
    if (win.platform === "macos" && !force) return null;

    return (
        <div className={cn("titlebar-controls flex items-center gap-0.5", className)}>
            <button
                type="button"
                onClick={win.minimize}
                aria-label={labels?.minimize ?? "Minimise"}
                className={BTN}
            >
                <Minus className="size-3.5" />
            </button>
            <button
                type="button"
                onClick={win.toggleMaximize}
                aria-label={
                    win.isMaximized
                        ? (labels?.restore ?? "Restore")
                        : (labels?.maximize ?? "Maximise")
                }
                className={BTN}
            >
                {/* Maximise is one square; restore is the Windows convention of two
                    overlapping ones, which is why the glyph is composed rather than imported. */}
                {win.isMaximized ? (
                    <span className="relative block size-3.5">
                        <Square className="absolute left-0 top-0 size-2.5" />
                        <Square className="absolute bottom-0 right-0 size-2.5" />
                    </span>
                ) : (
                    <Square className="size-3" />
                )}
            </button>
            <button
                type="button"
                onClick={win.close}
                aria-label={labels?.close ?? "Close"}
                className={cn(BTN, "hover:bg-destructive hover:text-destructive-foreground")}
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
