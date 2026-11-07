"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";

import {
    type StringClassName,
    asChildProps,
    asChildVoid,
    inferNativeButton,
    slotChild,
    slotContent,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

function Collapsible({
    className,
    ...props
}: StringClassName<React.ComponentProps<typeof CollapsiblePrimitive.Root>>) {
    return (
        <CollapsiblePrimitive.Root
            data-slot="collapsible"
            className={cn("min-w-0", className)}
            {...props}
        />
    );
}

type CollapsibleTriggerProps = StringClassName<
    React.ComponentProps<typeof CollapsiblePrimitive.Trigger>
> & {
    asChild?: boolean;
    chevron?: boolean;
};

function CollapsibleTrigger({
    className,
    asChild,
    chevron = true,
    children,
    nativeButton,
    render,
    ...props
}: CollapsibleTriggerProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const { child, inner } = slotChild(asChild, children, render);
    const content = (
        <>
            {chevron ? (
                <ChevronRightIcon
                    aria-hidden="true"
                    data-slot="collapsible-chevron"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-100 in-data-panel-open:rotate-90 motion-reduce:transition-none"
                />
            ) : null}
            {inner}
        </>
    );
    return (
        <CollapsiblePrimitive.Trigger
            data-slot="collapsible-trigger"
            className={cn(
                !child &&
                    "inline-flex max-w-full items-center gap-1 rounded-md text-left text-base font-medium text-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 [&:hover>[data-slot=collapsible-chevron]]:text-foreground",
                className,
            )}
            nativeButton={nativeButton ?? inferNativeButton(child ?? render)}
            {...props}
            {...slotContent(child, content)}
        />
    );
}

function CollapsibleContent({
    className,
    asChild,
    children,
    forceMount,
    keepMounted,
    ...props
}: StringClassName<React.ComponentProps<typeof CollapsiblePrimitive.Panel>> & {
    asChild?: boolean;
    forceMount?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <CollapsiblePrimitive.Panel
            data-slot="collapsible-content"
            keepMounted={keepMounted ?? forceMount}
            className={cn(
                "min-w-0 transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger, type CollapsibleTriggerProps };
