"use client";

import { type VariantProps, cva } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn";

function Select({ ...props }: ComponentProps<typeof SelectPrimitive.Root>) {
    return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: ComponentProps<typeof SelectPrimitive.Group>) {
    return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

// Heights, radius, padding and focus ring are Button's, so a trigger can stand in a row of
// buttons and inputs without anyone eyeballing the difference.
const selectTriggerVariants = cva(
    [
        "group/select-trigger flex items-center justify-between gap-2 rounded-md border border-input",
        "bg-transparent text-sm whitespace-nowrap shadow-xs outline-none",
        "transition-[color,background-color,border-color,box-shadow]",
        "hover:bg-accent/40 dark:bg-input/30 dark:hover:bg-input/50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // A click-opened trigger never gets :focus-visible, so the open panel would otherwise
        // hang off an unlit control.
        "data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
        "data-[placeholder]:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "*:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 *:data-[slot=select-value]:line-clamp-1",
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
    children,
    ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & VariantProps<typeof selectTriggerVariants>) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            data-size={size}
            className={cn(selectTriggerVariants({ size, className }))}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDownIcon className="size-4 opacity-60 transition-transform duration-200 group-data-[state=open]/select-trigger:rotate-180 motion-reduce:transition-none" />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    position = "item-aligned",
    align = "center",
    ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot="select-content"
                className={cn(
                    "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-e2 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    position === "popper" &&
                        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                    className,
                )}
                position={position}
                align={align}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                    className={cn(
                        "p-1.5",
                        position === "popper" &&
                            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
                    )}
                >
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            data-slot="select-label"
            className={cn("px-2 py-1.5 text-sm font-medium text-faint", className)}
            {...props}
        />
    );
}

function SelectItem({
    className,
    children,
    icon,
    description,
    ...props
}: ComponentProps<typeof SelectPrimitive.Item> & {
    /** Leading glyph. Drawn outside ItemText, so it never leaks into the trigger's value. */
    icon?: ReactNode;
    /** Second line under the label - outside ItemText for the same reason. */
    description?: ReactNode;
}) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                "group/select-item relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
                "focus:bg-accent focus:text-accent-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                // Ternaries, not `&&`: a ReactNode description is an object, and clsx would read
                // an object as a class map.
                description ? "items-start py-2" : null,
                className,
            )}
            {...props}
        >
            {/* pr-8 above reserves the gutter whether or not this row is the selected one, so the
                check appears without nudging a single character of the label. On a two-line row it
                sits against the label, not the block's midpoint. */}
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
                        "flex size-4 flex-none items-center justify-center text-muted-foreground group-focus/select-item:text-accent-foreground",
                        description ? "mt-0.5" : null,
                    )}
                >
                    {icon}
                </span>
            ) : null}
            {/* ItemText is styled from here, not with its own className: radix drops className and
                style off it so the copy it portals into the trigger stays unstyled. Its span is
                always the first child, and it is what lays a leading glyph next to the label. */}
            <span
                data-slot="select-item-body"
                className="flex min-w-0 flex-1 flex-col [&>span:first-child]:flex [&>span:first-child]:min-w-0 [&>span:first-child]:items-center [&>span:first-child]:gap-2"
            >
                <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
                {description ? (
                    <span
                        data-slot="select-item-description"
                        className="mt-0.5 text-sm leading-snug text-muted-foreground group-focus/select-item:text-accent-foreground/80"
                    >
                        {description}
                    </span>
                ) : null}
            </span>
        </SelectPrimitive.Item>
    );
}

function SelectSeparator({
    className,
    ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn("pointer-events-none -mx-1 my-1 h-px bg-border-soft", className)}
            {...props}
        />
    );
}

function SelectScrollUpButton({
    className,
    ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            data-slot="select-scroll-up-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 text-muted-foreground",
                className,
            )}
            {...props}
        >
            <ChevronUpIcon className="size-4" />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton({
    className,
    ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            data-slot="select-scroll-down-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 text-muted-foreground",
                className,
            )}
            {...props}
        >
            <ChevronDownIcon className="size-4" />
        </SelectPrimitive.ScrollDownButton>
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
