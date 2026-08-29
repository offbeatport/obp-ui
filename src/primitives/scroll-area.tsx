"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type * as React from "react";

import { type StringClassName, asChildVoid, slotChild, slotContent } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

type ScrollAreaType = "auto" | "always" | "scroll" | "hover";

function hidesWhenIdle(type: ScrollAreaType | undefined) {
    return type === undefined || type === "hover" || type === "scroll";
}

type RootStyle = React.ComponentProps<typeof ScrollAreaPrimitive.Root>["style"];

function hideDelayStyle(
    type: ScrollAreaType | undefined,
    scrollHideDelay: number | undefined,
    style: RootStyle,
): RootStyle {
    if (scrollHideDelay === undefined || !hidesWhenIdle(type)) {
        return style;
    }
    const delay = { "--scroll-area-hide-delay": `${scrollHideDelay}ms` } as React.CSSProperties;
    if (typeof style === "function") {
        return (state) => ({ ...style(state), ...delay });
    }
    return { ...style, ...delay };
}

function revealClasses(type: ScrollAreaType | undefined, orientation: "vertical" | "horizontal") {
    switch (type) {
        case "always":
            return "pointer-events-auto opacity-100";
        case "auto":
            return orientation === "horizontal"
                ? "data-has-overflow-x:pointer-events-auto data-has-overflow-x:opacity-100 data-has-overflow-x:transition-normal"
                : "data-has-overflow-y:pointer-events-auto data-has-overflow-y:opacity-100 data-has-overflow-y:transition-normal";
        case "scroll":
            return "data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-0 data-scrolling:transition-normal";
        default:
            return "data-hovering:pointer-events-auto data-hovering:opacity-100 data-hovering:delay-0 data-hovering:transition-normal data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-0 data-scrolling:transition-normal";
    }
}

type ScrollAreaProps = StringClassName<React.ComponentProps<typeof ScrollAreaPrimitive.Root>> & {
    asChild?: boolean;
    type?: ScrollAreaType;
    dir?: "ltr" | "rtl";
    scrollHideDelay?: number;
};

function ScrollArea({
    className,
    children,
    type,
    dir,
    style,
    asChild,
    scrollHideDelay,
    render,
    ...props
}: ScrollAreaProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner: content } = slotChild(asChild, children, render);
    const root = (
        <ScrollAreaPrimitive.Root
            data-slot="scroll-area"
            dir={dir}
            className={cn("relative", className)}
            style={hideDelayStyle(type, scrollHideDelay, style)}
            {...props}
            {...slotContent(
                child,
                <>
                    <ScrollAreaPrimitive.Viewport
                        data-slot="scroll-area-viewport"
                        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
                    >
                        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">
                            {content}
                        </ScrollAreaPrimitive.Content>
                    </ScrollAreaPrimitive.Viewport>
                    <ScrollBar type={type} />
                    <ScrollAreaPrimitive.Corner />
                </>,
            )}
        />
    );
    return dir ? <DirectionProvider direction={dir}>{root}</DirectionProvider> : root;
}

type ScrollBarProps = StringClassName<
    React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>
> & {
    asChild?: boolean;
    forceMount?: boolean;
    type?: ScrollAreaType;
};

function ScrollBar({
    className,
    orientation = "vertical",
    keepMounted,
    forceMount,
    type,
    asChild,
    children,
    render,
    ...props
}: ScrollBarProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child } = slotChild(asChild, children, render);
    return (
        <ScrollAreaPrimitive.Scrollbar
            data-slot="scroll-area-scrollbar"
            orientation={orientation}
            keepMounted={keepMounted ?? forceMount ?? (type === "always" || undefined)}
            className={cn(
                "flex touch-none p-px transition-[color,opacity,pointer-events] transition-discrete duration-150 select-none",
                "pointer-events-none opacity-0 [transition-delay:var(--scroll-area-hide-delay,0ms)]",
                revealClasses(type, orientation),
                orientation === "vertical" && "w-2.5 border-l border-l-transparent",
                orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
                className,
            )}
            {...props}
            {...slotContent(
                child,
                <ScrollAreaPrimitive.Thumb
                    data-slot="scroll-area-thumb"
                    className="relative flex-1 rounded-full bg-border"
                />,
            )}
        />
    );
}

export { ScrollArea, ScrollBar };
