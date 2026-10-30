"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { type VariantProps, cva } from "class-variance-authority";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import {
    type StringClassName,
    asChildRender,
    asChildVoid,
    inferNativeButton,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const checkboxVariants = cva(
    [
        "peer group/checkbox relative inline-flex shrink-0 items-center justify-center",
        "rounded-[calc(var(--radius)/2)] border border-input bg-card outline-none",
        "dark:data-unchecked:not-aria-invalid:border-foreground/20",
        "data-unchecked:not-data-disabled:hover:border-primary/60",
        "data-unchecked:not-data-disabled:hover:bg-accent/50",
        "data-unchecked:not-data-disabled:group-hover/checkbox-field:border-primary/60",
        "data-unchecked:not-data-disabled:group-hover/checkbox-field:bg-accent/50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "data-checked:border-primary data-indeterminate:border-primary",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive",
    ],
    {
        variants: {
            size: {
                default: "size-5",
                sm: "size-4",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

type CheckedState = boolean | "indeterminate";

type CheckboxProps = StringClassName<
    Omit<
        ComponentProps<typeof CheckboxPrimitive.Root>,
        "checked" | "defaultChecked" | "onCheckedChange" | "value"
    >
> &
    VariantProps<typeof checkboxVariants> & {
        asChild?: boolean;
        checked?: CheckedState;
        defaultChecked?: CheckedState;
        value?: string | number | readonly string[];
        onCheckedChange?: (
            checked: CheckedState,
            eventDetails: CheckboxPrimitive.Root.ChangeEventDetails,
        ) => void;
    };

function Checkbox({
    className,
    size = "default",
    checked,
    defaultChecked,
    indeterminate,
    onCheckedChange,
    nativeButton,
    render = <button type="button" />,
    asChild,
    children,
    value,
    ...props
}: CheckboxProps) {
    const [uncontrolledIndeterminate, setUncontrolledIndeterminate] = useState(
        () => checked === undefined && defaultChecked === "indeterminate",
    );

    const isIndeterminate =
        checked === "indeterminate" ||
        (checked === undefined && uncontrolledIndeterminate) ||
        indeterminate === true;

    if (asChildVoid(asChild, children)) return null;
    const resolvedRender = asChildRender(asChild, children) ?? render;

    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            data-size={size}
            nativeButton={nativeButton ?? inferNativeButton(resolvedRender)}
            render={resolvedRender}
            checked={checked === "indeterminate" ? false : checked}
            defaultChecked={defaultChecked === "indeterminate" ? false : defaultChecked}
            indeterminate={isIndeterminate}
            value={value === undefined ? undefined : String(value)}
            onCheckedChange={(next, eventDetails) => {
                setUncontrolledIndeterminate(false);
                onCheckedChange?.(next, eventDetails);
            }}
            className={cn(checkboxVariants({ size, className }))}
            {...props}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "absolute -inset-px scale-75 rounded-[inherit] bg-primary opacity-0",
                    "transition-[opacity,transform] duration-100 ease-out motion-reduce:transition-none",
                    "group-data-checked/checkbox:scale-100 group-data-checked/checkbox:opacity-100",
                    "group-data-indeterminate/checkbox:scale-100 group-data-indeterminate/checkbox:opacity-100",
                )}
            />
            <CheckboxPrimitive.Indicator
                keepMounted
                data-slot="checkbox-indicator"
                className="absolute inset-0 flex items-center justify-center text-primary-foreground"
            >
                <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="size-full group-data-indeterminate/checkbox:hidden"
                >
                    <path
                        d="M3.6 8.3 6.6 11.4 12.4 4.9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="square"
                        pathLength={1}
                        className={cn(
                            "[stroke-dasharray:1] [stroke-dashoffset:1]",
                            "transition-[stroke-dashoffset] duration-120 ease-out motion-reduce:transition-none",
                            "group-data-checked/checkbox:[stroke-dashoffset:0] group-data-checked/checkbox:delay-30",
                        )}
                    />
                </svg>
                <span
                    aria-hidden="true"
                    className="hidden h-0.5 w-1/2 bg-current group-data-indeterminate/checkbox:block"
                />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

type CheckboxFieldProps = Omit<CheckboxProps, "children" | "asChild"> & {
    asChild?: boolean;
    label: ReactNode;
    description?: ReactNode;
    checkboxClassName?: string;
};

function CheckboxField({
    id,
    label,
    description,
    className,
    checkboxClassName,
    size = "default",
    disabled,
    asChild: _asChild,
    ...props
}: CheckboxFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const descriptionId = description ? `${fieldId}-description` : undefined;

    return (
        <label
            htmlFor={fieldId}
            data-slot="checkbox-field"
            data-disabled={disabled || undefined}
            className={cn(
                "group/checkbox-field flex w-fit items-start gap-2 text-sm select-none",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                className,
            )}
        >
            <Checkbox
                id={fieldId}
                size={size}
                disabled={disabled}
                aria-describedby={descriptionId}
                className={cn(size === "sm" && "mt-0.5", checkboxClassName)}
                {...props}
            />
            <span className="min-w-0 group-data-[disabled]/checkbox-field:opacity-50">
                <span className="block font-medium">{label}</span>
                {description ? (
                    <span id={descriptionId} className="block text-sm text-muted-foreground">
                        {description}
                    </span>
                ) : null}
            </span>
        </label>
    );
}

export { Checkbox, CheckboxField, type CheckboxFieldProps, checkboxVariants, type CheckedState };
