"use client";

// A desktop titlebar: the strip you drag to move the window.
//
// Presentational and INERT ON THE WEB. Nothing from @tauri-apps is imported - dragging works
// because Tauri hit-tests the `data-tauri-drag-region` ATTRIBUTE natively (there is no CSS
// property involved; Electron's -webkit-app-region is a different mechanism, don't add it).
// In a browser the attribute is meaningless and the bar is just a flex row.
//
// Geometry mirrors desktop.css's `.titlebar` rule, which wins the cascade when that
// stylesheet is loaded (`html.is-desktop .titlebar`) and resolves to the same values. The
// Tailwind utilities below are what makes the bar work WITHOUT desktop.css:
//   --titlebar-height  the strip's height (38px default)
//   --titlebar-inset   leading space reserved for the macOS traffic lights (78px there, 0
//                      elsewhere) so nothing renders underneath them
//
// The drag attribute only applies to the element it is written on - children are NOT
// draggable unless they carry it too. That is Tauri's design, and it is why buttons and
// inputs in the leading/trailing slots keep working.

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type TitleBarProps = {
    /** Left of the title, after the traffic-light inset - a brand mark, a back button. */
    leading?: ReactNode;
    /** The centre run. A plain string gets the muted title treatment. */
    title?: ReactNode;
    /** Trailing run - window controls, a menu button. Pushed to the far edge. */
    actions?: ReactNode;
    /** Anything else, rendered after the title (still inside the drag region). */
    children?: ReactNode;
    /** Turn the drag region off (e.g. a titlebar inside a non-draggable panel). */
    draggable?: boolean;
    className?: string;
    titleClassName?: string;
};

export function TitleBar({
    leading,
    title,
    actions,
    children,
    draggable = true,
    className,
    titleClassName,
}: TitleBarProps) {
    return (
        <div
            // Tauri reads this attribute natively; on the web it is inert.
            data-tauri-drag-region={draggable ? "" : undefined}
            className={cn(
                "titlebar flex flex-none items-center gap-2 border-b bg-secondary",
                "h-[var(--titlebar-height,38px)] ps-[calc(var(--titlebar-inset,0px)+0.5rem)] pe-2",
                className,
            )}
        >
            {leading}
            {title !== undefined && (
                <div
                    className={cn(
                        "min-w-0 truncate text-[12px] font-semibold text-muted-foreground",
                        titleClassName,
                    )}
                >
                    {title}
                </div>
            )}
            {children}
            {actions !== undefined && (
                <div className="ms-auto flex items-center gap-0.5">{actions}</div>
            )}
        </div>
    );
}
