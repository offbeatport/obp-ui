"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useRender } from "@base-ui/react/use-render";
import {
    type ComponentProps,
    type RefObject,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    autoFocusFor,
    collisionAvoidanceFor,
    stickyFor,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

type PopoverAnchorValue = ComponentProps<typeof PopoverPrimitive.Positioner>["anchor"];

type Measurable = { getBoundingClientRect(): DOMRect };

const PopoverAnchorContext = createContext<
    readonly [PopoverAnchorValue, (anchor: PopoverAnchorValue) => void] | null
>(null);

type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
type FocusOutsideEvent = CustomEvent<{ originalEvent: FocusEvent }>;

type PopoverDismissHandlers = {
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onFocusOutside?: (event: FocusOutsideEvent) => void;
    onInteractOutside?: (event: PointerDownOutsideEvent | FocusOutsideEvent) => void;
    onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
};

type PopoverDismissContextValue = {
    handlers: RefObject<PopoverDismissHandlers>;
    setDisableOutsidePointerEvents: (disabled: boolean) => void;
};

const PopoverDismissContext = createContext<PopoverDismissContextValue | null>(null);

type PopoverProps = ComponentProps<typeof PopoverPrimitive.Root>;
type PopoverChangeDetails = Parameters<NonNullable<PopoverProps["onOpenChange"]>>[1];

function runDismissHandlers(handlers: PopoverDismissHandlers, details: PopoverChangeDetails) {
    if (details.reason === "escape-key") {
        if (!handlers.onEscapeKeyDown) {
            return;
        }

        const event = details.event;
        handlers.onEscapeKeyDown(event);

        if (event.defaultPrevented) {
            details.cancel();
        }

        return;
    }

    if (details.reason === "outside-press") {
        if (!handlers.onPointerDownOutside && !handlers.onInteractOutside) {
            return;
        }

        const event: PointerDownOutsideEvent = new CustomEvent(
            "dismissableLayer.pointerDownOutside",
            {
                bubbles: false,
                cancelable: true,
                detail: { originalEvent: details.event as PointerEvent },
            },
        );

        handlers.onPointerDownOutside?.(event);
        handlers.onInteractOutside?.(event);

        if (event.defaultPrevented) {
            details.cancel();
        }

        return;
    }

    if (details.reason === "focus-out") {
        if (!handlers.onFocusOutside && !handlers.onInteractOutside) {
            return;
        }

        const event: FocusOutsideEvent = new CustomEvent("dismissableLayer.focusOutside", {
            bubbles: false,
            cancelable: true,
            detail: { originalEvent: details.event as FocusEvent },
        });

        handlers.onFocusOutside?.(event);
        handlers.onInteractOutside?.(event);

        if (event.defaultPrevented) {
            details.cancel();
        }
    }
}

function Popover({ modal, onOpenChange, ...props }: PopoverProps) {
    const [anchor, setAnchorState] = useState<PopoverAnchorValue>(null);

    const setAnchor = useCallback((next: PopoverAnchorValue) => {
        setAnchorState(() => next ?? null);
    }, []);

    const anchorContext = useMemo(() => [anchor, setAnchor] as const, [anchor, setAnchor]);

    const handlers = useRef<PopoverDismissHandlers>({});
    const [disableOutsidePointerEvents, setDisableOutsidePointerEvents] = useState(false);

    const dismissContext = useMemo<PopoverDismissContextValue>(
        () => ({ handlers, setDisableOutsidePointerEvents }),
        [],
    );

    const handleOpenChange = useCallback<NonNullable<PopoverProps["onOpenChange"]>>(
        (open, details) => {
            if (!open) {
                runDismissHandlers(handlers.current, details);
            }

            if (!details.isCanceled) {
                onOpenChange?.(open, details);
            }
        },
        [onOpenChange],
    );

    return (
        <PopoverAnchorContext.Provider value={anchorContext}>
            <PopoverDismissContext.Provider value={dismissContext}>
                <PopoverPrimitive.Root
                    data-slot="popover"
                    modal={modal ?? (disableOutsidePointerEvents || undefined)}
                    onOpenChange={handleOpenChange}
                    {...props}
                />
            </PopoverDismissContext.Provider>
        </PopoverAnchorContext.Provider>
    );
}

type PopoverTriggerProps = StringClassName<ComponentProps<typeof PopoverPrimitive.Trigger>> & {
    asChild?: boolean;
};

function PopoverTrigger({ asChild, children, ...props }: PopoverTriggerProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }

    return (
        <PopoverPrimitive.Trigger
            data-slot="popover-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

type PopoverAnchorProps = ComponentProps<"div"> & {
    asChild?: boolean;
    virtualRef?: RefObject<Measurable | null>;
};

function PopoverAnchor({ asChild, virtualRef, children, ...props }: PopoverAnchorProps) {
    const [, setAnchor] = useContext(PopoverAnchorContext) ?? [];

    useEffect(() => {
        if (!virtualRef || !setAnchor) {
            return;
        }

        setAnchor(() => virtualRef.current);
        return () => setAnchor(null);
    }, [virtualRef, setAnchor]);

    const setAnchorElement = useCallback(
        (element: HTMLElement | null) => {
            setAnchor?.(element);
        },
        [setAnchor],
    );

    return useRender({
        defaultTagName: "div",
        enabled: !virtualRef && !asChildVoid(asChild, children),
        ref: setAnchorElement,
        render: asChildRender(asChild, children),
        props: {
            "data-slot": "popover-anchor",
            ...props,
            ...(asChild ? {} : { children }),
        },
    });
}

type PopoverContentProps = StringClassName<ComponentProps<typeof PopoverPrimitive.Popup>> &
    Pick<
        ComponentProps<typeof PopoverPrimitive.Positioner>,
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
        avoidCollisions?: boolean;
        disableOutsidePointerEvents?: boolean;
        onEscapeKeyDown?: (event: KeyboardEvent) => void;
        onFocusOutside?: (event: FocusOutsideEvent) => void;
        onInteractOutside?: (event: PointerDownOutsideEvent | FocusOutsideEvent) => void;
        onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
        forceMount?: boolean;
        onCloseAutoFocus?: (event: Event) => void;
        onOpenAutoFocus?: (event: Event) => void;
        sticky?: boolean | "partial" | "always";
    };

function PopoverContent({
    className,
    align = "center",
    sideOffset = 6,
    alignOffset,
    anchor,
    arrowPadding,
    avoidCollisions,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    disableOutsidePointerEvents,
    finalFocus,
    forceMount,
    initialFocus,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onFocusOutside,
    onInteractOutside,
    onOpenAutoFocus,
    onPointerDownOutside,
    positionMethod,
    side,
    sticky,
    asChild,
    children,
    ...props
}: PopoverContentProps) {
    const [anchorValue] = useContext(PopoverAnchorContext) ?? [];
    const resolvedAnchor = anchor !== undefined ? anchor : (anchorValue ?? undefined);
    const dismiss = useContext(PopoverDismissContext);

    useEffect(() => {
        if (!dismiss) {
            return;
        }

        dismiss.handlers.current = {
            onEscapeKeyDown,
            onFocusOutside,
            onInteractOutside,
            onPointerDownOutside,
        };

        return () => {
            dismiss.handlers.current = {};
        };
    }, [dismiss, onEscapeKeyDown, onFocusOutside, onInteractOutside, onPointerDownOutside]);

    useEffect(() => {
        dismiss?.setDisableOutsidePointerEvents(disableOutsidePointerEvents === true);

        return () => {
            dismiss?.setDisableOutsidePointerEvents(false);
        };
    }, [disableOutsidePointerEvents, dismiss]);

    if (asChildVoid(asChild, children)) {
        return null;
    }

    return (
        <PopoverPrimitive.Portal keepMounted={forceMount}>
            <PopoverPrimitive.Positioner
                data-slot="popover-positioner"
                align={align}
                alignOffset={alignOffset}
                anchor={resolvedAnchor}
                arrowPadding={arrowPadding}
                className="z-50"
                collisionAvoidance={collisionAvoidanceFor(avoidCollisions, collisionAvoidance)}
                collisionBoundary={collisionBoundary}
                collisionPadding={collisionPadding}
                disableAnchorTracking={disableAnchorTracking}
                positionMethod={positionMethod}
                side={side}
                sideOffset={sideOffset}
                sticky={stickyFor(sticky)}
            >
                <PopoverPrimitive.Popup
                    data-slot="popover-content"
                    className={cn(
                        "w-72 origin-(--transform-origin) rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-e2 outline-none",
                        "transition-[translate,scale,opacity] duration-150 data-instant:transition-none",
                        "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
                        "data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
                        className,
                    )}
                    finalFocus={
                        finalFocus ??
                        autoFocusFor(onCloseAutoFocus, "focusScope.autoFocusOnUnmount")
                    }
                    initialFocus={
                        initialFocus ?? autoFocusFor(onOpenAutoFocus, "focusScope.autoFocusOnMount")
                    }
                    {...props}
                    {...asChildProps(asChild, children)}
                />
            </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
    );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
