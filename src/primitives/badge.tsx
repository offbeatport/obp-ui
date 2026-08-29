"use client";

import { useRender } from "@base-ui/react/use-render";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { asChildRender, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
                secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
                destructive:
                    "bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
                outline:
                    "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
                link: "text-primary underline-offset-4 [a&]:hover:underline",
                success: "border-transparent bg-success-soft text-success font-semibold",
                warning: "border-transparent bg-warning-soft text-warning font-semibold",
                info: "border-transparent bg-info-soft text-info font-semibold",
                approval: "border-transparent bg-approval-soft text-approval font-semibold",
                neutral: "border-transparent bg-neutral-soft text-neutral font-semibold",
                accent: "border-transparent bg-accent text-accent-foreground font-semibold",
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
