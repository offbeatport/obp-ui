"use client";

import { useRender } from "@base-ui/react/use-render";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { asChildRender, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-1.5 text-sm leading-5 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
                secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
                destructive:
                    "bg-destructive text-destructive-foreground focus-visible:ring-destructive [a&]:hover:bg-destructive/90",
                outline: "border-border text-foreground [a&]:hover:bg-secondary",
                ghost: "[a&]:hover:bg-secondary",
                link: "text-primary underline-offset-4 [a&]:hover:underline",
                success: "border-success/40 text-success",
                warning: "border-warning/40 text-warning",
                info: "border-info/40 text-info",
                approval: "border-approval/40 text-approval",
                neutral: "border-neutral/40 text-neutral",
                accent: "border-primary/40 text-accent-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Badge({
    className,
    variant = "default",
    asChild = false,
    children,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
    return useRender({
        defaultTagName: "span",
        render: asChildRender(asChild, children),
        enabled: !asChildVoid(asChild, children),
        props: {
            "data-slot": "badge",
            "data-variant": variant,
            className: cn(badgeVariants({ variant }), className),
            ...props,
            ...(asChild ? {} : { children }),
        },
    });
}

export { Badge, badgeVariants };
