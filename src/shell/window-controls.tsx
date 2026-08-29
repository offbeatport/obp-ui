"use client";

import { Minus, Square, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useWindowControls } from "./window-controls-context";

export type WindowControlsProps = {
    force?: boolean;
    className?: string;
    labels?: { minimize?: string; maximize?: string; restore?: string; close?: string };
};

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
