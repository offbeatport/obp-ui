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
                "peer group/switch inline-flex shrink-0 items-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:border-primary data-checked:bg-primary data-unchecked:border-muted-foreground data-unchecked:bg-secondary",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block rounded-full ring-0 transition-transform motion-reduce:transition-none group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5 data-checked:bg-primary-foreground data-unchecked:translate-x-px data-unchecked:bg-muted-foreground group-data-[size=default]/switch:data-checked:translate-x-[15px] group-data-[size=sm]/switch:data-checked:translate-x-[11px]",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
