"use client";

import { useRender } from "@base-ui/react/use-render";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { asChildRender, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
                outline: "border border-input bg-card text-foreground hover:bg-secondary",
                secondary:
                    "border border-input bg-secondary text-secondary-foreground hover:bg-border-soft",
                success: "bg-success text-success-foreground hover:bg-success/90",
                ghost: "text-foreground hover:bg-secondary",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-8 px-3 has-[>svg]:px-2.5",
                xs: "h-6 gap-1 px-2 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 px-2.5 has-[>svg]:px-2",
                lg: "h-9 px-4 has-[>svg]:px-3",
                xl: "h-11 px-5 text-base has-[>svg]:px-4 [&_svg:not([class*='size-'])]:size-5",
                icon: "size-8",
                "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
                "icon-sm": "size-7",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    children,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    return useRender({
        defaultTagName: "button",
        render: asChildRender(asChild, children),
        enabled: !asChildVoid(asChild, children),
        props: {
            "data-slot": "button",
            "data-variant": variant,
            "data-size": size,
            className: cn(buttonVariants({ variant, size, className })),
            type: props.type,
            ...props,
            ...(asChild ? {} : { children }),
        },
    });
}

export { Button, buttonVariants };
