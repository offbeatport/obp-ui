"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

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
            className={cn("grid gap-2", className)}
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
                "inline-flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        >
            <RadioPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="relative flex items-center justify-center"
            >
                <span className="size-2 rounded-full bg-primary" />
            </RadioPrimitive.Indicator>
        </RadioPrimitive.Root>
    );
}

export { RadioGroup, RadioGroupItem };
