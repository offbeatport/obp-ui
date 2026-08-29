"use client";

import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";

import { asChildRender, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

function Label({
    className,
    asChild = false,
    children,
    onMouseDown,
    ...props
}: React.ComponentProps<"label"> & { asChild?: boolean }) {
    return useRender({
        defaultTagName: "label",
        enabled: !asChildVoid(asChild, children),
        render: asChildRender(asChild, children),
        props: {
            "data-slot": "label",
            className: cn(
                "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-disabled:pointer-events-none group-data-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                className,
            ),
            ...props,
            ...(asChild ? {} : { children }),
            onMouseDown: (event: React.MouseEvent<HTMLLabelElement>) => {
                if ((event.target as Element).closest("button, input, select, textarea")) return;
                onMouseDown?.(event);
                if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
            },
        },
    });
}

export { Label };
