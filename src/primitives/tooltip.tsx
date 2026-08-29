"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    collisionAvoidanceFor,
    stickyFor,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const TooltipDelayContext = React.createContext<number | undefined>(undefined);
const TooltipDisableHoverableContext = React.createContext<boolean | undefined>(undefined);
const TooltipSkipDelayContext = React.createContext<number | undefined>(undefined);
const TooltipCloseDelayContext = React.createContext<number | undefined>(undefined);

type TooltipProviderProps = Omit<
    React.ComponentProps<typeof TooltipPrimitive.Provider>,
    "delay" | "timeout"
> & {
    delayDuration?: number;
    skipDelayDuration?: number;
    disableHoverableContent?: boolean;
};

function TooltipProvider({
    delayDuration = 0,
    skipDelayDuration = 300,
    disableHoverableContent,
    closeDelay,
    children,
    ...props
}: TooltipProviderProps) {
    return (
        <TooltipPrimitive.Provider
            data-slot="tooltip-provider"
            delay={delayDuration}
            timeout={skipDelayDuration}
            closeDelay={closeDelay}
            {...props}
        >
            <TooltipDisableHoverableContext.Provider value={disableHoverableContent}>
                <TooltipSkipDelayContext.Provider value={skipDelayDuration}>
                    <TooltipCloseDelayContext.Provider value={closeDelay}>
                        {children}
                    </TooltipCloseDelayContext.Provider>
                </TooltipSkipDelayContext.Provider>
            </TooltipDisableHoverableContext.Provider>
        </TooltipPrimitive.Provider>
    );
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root> & {
    delayDuration?: number;
    disableHoverableContent?: boolean;
};

function Tooltip({ delayDuration, disableHoverableContent, children, ...props }: TooltipProps) {
    const providerDisableHoverableContent = React.useContext(TooltipDisableHoverableContext);
    const providerSkipDelayDuration = React.useContext(TooltipSkipDelayContext);
    const providerCloseDelay = React.useContext(TooltipCloseDelayContext);

    const root = (
        <TooltipPrimitive.Root
            data-slot="tooltip"
            disableHoverablePopup={disableHoverableContent ?? providerDisableHoverableContent}
            {...props}
        >
            {children}
        </TooltipPrimitive.Root>
    );

    return (
        <TooltipDelayContext.Provider value={delayDuration}>
            {delayDuration === undefined ? (
                root
            ) : (
                <TooltipPrimitive.Provider
                    delay={delayDuration}
                    timeout={providerSkipDelayDuration}
                    closeDelay={providerCloseDelay}
                >
                    {root}
                </TooltipPrimitive.Provider>
            )}
        </TooltipDelayContext.Provider>
    );
}

type TooltipTriggerProps = StringClassName<
    React.ComponentProps<typeof TooltipPrimitive.Trigger>
> & {
    asChild?: boolean;
};

function TooltipTrigger({ asChild = false, children, ...props }: TooltipTriggerProps) {
    const delay = React.useContext(TooltipDelayContext);

    if (asChildVoid(asChild, children)) {
        return null;
    }

    return (
        <TooltipPrimitive.Trigger
            data-slot="tooltip-trigger"
            delay={delay}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

type TooltipContentProps = StringClassName<React.ComponentProps<typeof TooltipPrimitive.Popup>> &
    Pick<
        React.ComponentProps<typeof TooltipPrimitive.Positioner>,
        | "align"
        | "alignOffset"
        | "anchor"
        | "arrowPadding"
        | "collisionAvoidance"
        | "collisionBoundary"
        | "collisionPadding"
        | "disableAnchorTracking"
        | "positionMethod"
        | "side"
        | "sideOffset"
    > & {
        asChild?: boolean;
        forceMount?: boolean;
        avoidCollisions?: boolean;
        sticky?: boolean | "partial" | "always";
    };

function TooltipContent({
    className,
    sideOffset = 0,
    side,
    align,
    alignOffset,
    anchor,
    arrowPadding,
    avoidCollisions,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    positionMethod,
    sticky,
    forceMount,
    asChild = false,
    children,
    ...props
}: TooltipContentProps) {
    const render = asChildRender(asChild, children);

    if (asChildVoid(asChild, children)) {
        return null;
    }

    return (
        <TooltipPrimitive.Portal keepMounted={forceMount}>
            <TooltipPrimitive.Positioner
                className="z-50"
                side={side}
                sideOffset={sideOffset}
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                arrowPadding={arrowPadding}
                collisionAvoidance={collisionAvoidanceFor(avoidCollisions, collisionAvoidance)}
                collisionBoundary={collisionBoundary}
                collisionPadding={collisionPadding}
                disableAnchorTracking={disableAnchorTracking}
                positionMethod={positionMethod}
                sticky={stickyFor(sticky)}
            >
                <TooltipPrimitive.Popup
                    data-slot="tooltip-content"
                    className={cn(
                        "relative w-fit origin-(--transform-origin) rounded-md bg-foreground px-3 py-1.5 text-sm text-balance text-background",
                        "transition-[translate,scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0",
                        "data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
                        className,
                    )}
                    {...props}
                    {...(render ? { render } : {})}
                >
                    {render ? undefined : (
                        <>
                            {children}
                            <TooltipPrimitive.Arrow className="z-50 size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=bottom]:top-[-3px] data-[side=left]:right-[-3px] data-[side=right]:left-[-3px] data-[side=top]:bottom-[-3px]" />
                        </>
                    )}
                </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
