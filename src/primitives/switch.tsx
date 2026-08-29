"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type * as React from "react";

import {
    type StringClassName,
    asChildRender,
    asChildVoid,
    inferNativeButton,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

type SwitchProps = StringClassName<React.ComponentProps<typeof SwitchPrimitive.Root>> & {
    size?: "sm" | "default";
    asChild?: boolean;
};

function Switch({
    className,
    size = "default",
    asChild = false,
    children,
    nativeButton,
    render,
    ...props
}: SwitchProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }

    const element = render ?? asChildRender(asChild, children) ?? <button type="button" />;

    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            data-size={size}
            nativeButton={nativeButton ?? inferNativeButton(element)}
            render={element}
            className={cn(
                "peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
