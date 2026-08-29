"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { type VariantProps, cva } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Children, type ComponentProps, type ReactNode, isValidElement, useMemo } from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    autoFocusFor,
    childrenOf,
    collisionAvoidanceFor,
    inferNativeButton,
    slotChild,
    slotContent,
    stickyFor,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

function collectItems(node: ReactNode, out: { value: unknown; label: ReactNode }[]): void {
    Children.forEach(node, (child) => {
        if (!isValidElement(child)) {
            return;
        }
        const props = child.props as {
            value?: unknown;
            children?: ReactNode;
            textValue?: string;
            label?: ReactNode;
            asChild?: boolean;
        };
        if (child.type !== SelectItem) {
            collectItems(props.children, out);
            return;
        }
        if (props.value === undefined) {
            return;
        }
        const rendered = asChildRender(props.asChild, props.children);
        const label = rendered ? childrenOf(rendered) : props.children;
        out.push({ value: props.value, label: label ?? props.textValue ?? props.label });
    });
}

type SelectProps<Value = string, Multiple extends boolean | undefined = false> = Omit<
    SelectPrimitive.Root.Props<Value, Multiple>,
    "onValueChange"
> & {
    onValueChange?: (
        value: Multiple extends true ? Value[] : Value,
        eventDetails: SelectPrimitive.Root.ChangeEventDetails,
    ) => void;
    dir?: "ltr" | "rtl";
};

function Select<Value = string, Multiple extends boolean | undefined = false>({
    dir,
    items,
    children,
    ...props
}: SelectProps<Value, Multiple>) {
    const collected = useMemo(() => {
        if (items !== undefined) {
            return items;
        }
        const found: { value: unknown; label: ReactNode }[] = [];
        collectItems(children, found);
        return found.length > 0 ? found : undefined;
    }, [items, children]);
    const root = (
        <SelectPrimitive.Root
            data-slot="select"
            {...(props as SelectPrimitive.Root.Props<Value, Multiple>)}
            items={collected as SelectPrimitive.Root.Props<Value, Multiple>["items"]}
        >
            {children}
        </SelectPrimitive.Root>
    );
    return dir ? <DirectionProvider direction={dir}>{root}</DirectionProvider> : root;
}

function SelectGroup({
    asChild,
    children,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.Group>> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <SelectPrimitive.Group
            data-slot="select-group"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function SelectValue({
    asChild,
    children,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.Value>> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children as ReactNode)) {
        return null;
    }
    return (
        <SelectPrimitive.Value
            data-slot="select-value"
            {...props}
            {...asChildProps(asChild, children as ReactNode)}
        />
    );
}

const selectTriggerVariants = cva(
    [
        "group/select-trigger flex items-center justify-between gap-2 rounded-md border border-input",
        "bg-transparent text-sm whitespace-nowrap shadow-xs outline-none",
        "transition-[color,background-color,border-color,box-shadow]",
        "hover:bg-accent/40 dark:bg-input/30 dark:hover:bg-input/50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-popup-open:border-ring data-popup-open:ring-[3px] data-popup-open:ring-ring/50",
        "data-[placeholder]:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "*:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 *:data-[slot=select-value]:overflow-hidden *:data-[slot=select-value]:text-ellipsis *:data-[slot=select-value]:whitespace-nowrap",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
    ],
    {
        variants: {
            size: {
                sm: "h-8 px-2.5",
                default: "h-9 px-3",
                lg: "h-10 px-4",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

function SelectTrigger({
    className,
    size = "default",
    asChild,
    children,
    nativeButton,
    render,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.Trigger>> &
    VariantProps<typeof selectTriggerVariants> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            {inner}
            <SelectPrimitive.Icon
                render={
                    <ChevronDownIcon className="size-4 opacity-60 transition-transform duration-200 data-popup-open:rotate-180 motion-reduce:transition-none" />
                }
            >
                {null}
            </SelectPrimitive.Icon>
        </>
    );
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            data-size={size}
            className={cn(selectTriggerVariants({ size, className }))}
            nativeButton={nativeButton ?? inferNativeButton(child ?? render)}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

type SelectContentProps = StringClassName<ComponentProps<typeof SelectPrimitive.Popup>> &
    Pick<
        ComponentProps<typeof SelectPrimitive.Positioner>,
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
        position?: "item-aligned" | "popper";
        avoidCollisions?: boolean;
        onCloseAutoFocus?: (event: Event) => void;
        asChild?: boolean;
        sticky?: boolean | "partial" | "always";
    };

function SelectContent({
    className,
    children,
    position = "item-aligned",
    align = "center",
    side,
    sideOffset,
    alignOffset,
    anchor,
    arrowPadding,
    avoidCollisions,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    onCloseAutoFocus,
    positionMethod,
    sticky,
    asChild,
    render,
    ...props
}: SelectContentProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            <SelectScrollUpButton />
            <SelectPrimitive.List
                className={cn(
                    "max-h-(--available-height) min-h-0 overflow-x-hidden overflow-y-auto p-1.5",
                    position === "popper" && "scroll-my-1",
                )}
            >
                {inner}
            </SelectPrimitive.List>
            <SelectScrollDownButton />
        </>
    );
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
                data-slot="select-positioner"
                className="z-50 outline-none"
                alignItemWithTrigger={position === "item-aligned"}
                align={align}
                side={side}
                sideOffset={sideOffset ?? (position === "popper" ? 4 : 0)}
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
                <SelectPrimitive.Popup
                    data-slot="select-content"
                    className={cn(
                        "relative flex flex-col origin-(--transform-origin) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-e2",
                        "transition-[scale,opacity] duration-150",
                        "data-starting-style:scale-95 data-starting-style:opacity-0",
                        "data-ending-style:scale-95 data-ending-style:opacity-0",
                        "data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none data-[side=none]:data-ending-style:transition-none",
                        position === "popper"
                            ? "min-w-[max(8rem,var(--anchor-width))]"
                            : "min-w-[8rem]",
                        className,
                    )}
                    finalFocus={autoFocusFor(onCloseAutoFocus, "focusScope.autoFocusOnUnmount")}
                    render={render}
                    {...props}
                    {...slotContent(child, content)}
                />
            </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
    );
}

function SelectLabel({
    className,
    asChild,
    children,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.GroupLabel>> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <SelectPrimitive.GroupLabel
            data-slot="select-label"
            className={cn("px-2 py-1.5 text-sm font-medium text-faint", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function SelectItem({
    className,
    children,
    icon,
    description,
    label,
    textValue,
    asChild,
    render,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.Item>> & {
    icon?: ReactNode;
    description?: ReactNode;
    textValue?: string;
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            <span
                data-slot="select-item-indicator"
                className={cn(
                    "pointer-events-none absolute right-2 flex size-4 items-center justify-center",
                    description ? "top-2.5" : "top-1/2 -translate-y-1/2",
                )}
            >
                <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-4 text-primary" />
                </SelectPrimitive.ItemIndicator>
            </span>
            {icon ? (
                <span
                    data-slot="select-item-icon"
                    className={cn(
                        "flex size-4 flex-none items-center justify-center text-muted-foreground group-data-highlighted/select-item:text-accent-foreground",
                        description ? "mt-0.5" : null,
                    )}
                >
                    {icon}
                </span>
            ) : null}
            <span
                data-slot="select-item-body"
                className="flex min-w-0 flex-1 flex-col [&>span:first-child]:flex [&>span:first-child]:min-w-0 [&>span:first-child]:items-center [&>span:first-child]:gap-2"
            >
                <SelectPrimitive.ItemText render={<span />}>{inner}</SelectPrimitive.ItemText>
                {description ? (
                    <span
                        data-slot="select-item-description"
                        className="mt-0.5 text-sm leading-snug text-muted-foreground group-data-highlighted/select-item:text-accent-foreground/80"
                    >
                        {description}
                    </span>
                ) : null}
            </span>
        </>
    );
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            label={textValue ?? label}
            className={cn(
                "group/select-item relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
                "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                description ? "items-start py-2" : null,
                className,
            )}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

function SelectSeparator({
    className,
    asChild,
    children,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.Separator>> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn("pointer-events-none -mx-1 my-1 h-px bg-border-soft", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function SelectScrollUpButton({
    className,
    asChild,
    children,
    render,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.ScrollUpArrow>> & { asChild?: boolean }) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            {inner}
            <ChevronUpIcon className="size-4" />
        </>
    );
    return (
        <SelectPrimitive.ScrollUpArrow
            data-slot="select-scroll-up-button"
            className={cn(
                "top-0 z-[1] flex w-full cursor-default items-center justify-center rounded-t-lg bg-popover py-1 text-muted-foreground",
                className,
            )}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

function SelectScrollDownButton({
    className,
    asChild,
    children,
    render,
    ...props
}: StringClassName<ComponentProps<typeof SelectPrimitive.ScrollDownArrow>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            {inner}
            <ChevronDownIcon className="size-4" />
        </>
    );
    return (
        <SelectPrimitive.ScrollDownArrow
            data-slot="select-scroll-down-button"
            className={cn(
                "bottom-0 z-[1] flex w-full cursor-default items-center justify-center rounded-b-lg bg-popover py-1 text-muted-foreground",
                className,
            )}
            render={render}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    selectTriggerVariants,
    SelectValue,
};
