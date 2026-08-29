"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    inferNativeButton,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const TabsActivationModeContext = React.createContext<"automatic" | "manual">("automatic");

type TabsProps = StringClassName<Omit<React.ComponentProps<typeof TabsPrimitive.Root>, "dir">> & {
    asChild?: boolean;
    activationMode?: "automatic" | "manual";
    dir?: "ltr" | "rtl";
};

function Tabs({
    className,
    orientation = "horizontal",
    activationMode = "automatic",
    dir,
    asChild,
    children,
    defaultValue = null,
    ...props
}: TabsProps) {
    if (asChildVoid(asChild, children)) return null;

    const root = (
        <TabsPrimitive.Root
            data-slot="tabs"
            data-orientation={orientation}
            orientation={orientation}
            defaultValue={defaultValue}
            dir={dir}
            className={cn(
                "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );

    return (
        <TabsActivationModeContext.Provider value={activationMode}>
            {dir ? <DirectionProvider direction={dir}>{root}</DirectionProvider> : root}
        </TabsActivationModeContext.Provider>
    );
}

const tabsListVariants = cva(
    "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
    {
        variants: {
            variant: {
                default: "bg-muted",
                line: "gap-1 bg-transparent",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

type TabsListProps = StringClassName<React.ComponentProps<typeof TabsPrimitive.List>> &
    VariantProps<typeof tabsListVariants> & {
        asChild?: boolean;
        loop?: boolean;
    };

function TabsList({
    className,
    variant = "default",
    activateOnFocus,
    loop,
    loopFocus,
    asChild,
    children,
    ...props
}: TabsListProps) {
    const activationMode = React.useContext(TabsActivationModeContext);

    if (asChildVoid(asChild, children)) return null;

    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            data-variant={variant}
            activateOnFocus={activateOnFocus ?? activationMode !== "manual"}
            loopFocus={loop ?? loopFocus}
            className={cn(tabsListVariants({ variant }), className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

type TabsTriggerProps = StringClassName<React.ComponentProps<typeof TabsPrimitive.Tab>> & {
    asChild?: boolean;
};

function TabsTrigger({ className, nativeButton, asChild, children, ...props }: TabsTriggerProps) {
    if (asChildVoid(asChild, children)) return null;

    return (
        <TabsPrimitive.Tab
            data-slot="tabs-trigger"
            nativeButton={
                nativeButton ?? inferNativeButton(asChildRender(asChild, children) ?? props.render)
            }
            className={cn(
                "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-disabled:pointer-events-none data-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
                "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
                "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

type TabsContentProps = StringClassName<React.ComponentProps<typeof TabsPrimitive.Panel>> & {
    asChild?: boolean;
    forceMount?: boolean;
};

function TabsContent({
    className,
    forceMount,
    keepMounted,
    asChild,
    children,
    ...props
}: TabsContentProps) {
    if (asChildVoid(asChild, children)) return null;

    return (
        <TabsPrimitive.Panel
            data-slot="tabs-content"
            keepMounted={forceMount ?? keepMounted}
            className={cn("flex-1 outline-none", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
