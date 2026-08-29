"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { CircleIcon } from "lucide-react";

import { type StringClassName, asChildProps, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

type RadioGroupProps = StringClassName<Omit<RadioGroupPrimitive.Props, "render">> & {
    asChild?: boolean;
};

function RadioGroup({ className, asChild = false, children, dir, ...props }: RadioGroupProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }

    const group = (
        <RadioGroupPrimitive
            data-slot="radio-group"
            dir={dir}
            className={cn("grid gap-3", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );

    return dir ? (
        <DirectionProvider direction={dir === "rtl" ? "rtl" : "ltr"}>{group}</DirectionProvider>
    ) : (
        group
    );
}

type RadioGroupItemProps = StringClassName<Omit<RadioPrimitive.Root.Props, "render">> & {
    asChild?: boolean;
};

function RadioGroupItem({ className, asChild = false, children, ...props }: RadioGroupItemProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }

    return (
        <RadioPrimitive.Root
            data-slot="radio-group-item"
            className={cn(
                "inline-flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        >
            <RadioPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="relative flex items-center justify-center"
            >
                <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
            </RadioPrimitive.Indicator>
        </RadioPrimitive.Root>
    );
}

export { RadioGroup, RadioGroupItem };
