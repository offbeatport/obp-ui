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
        "rounded-[calc(var(--radius)/3)] border border-input bg-card shadow-xs outline-none",
        "transition-[color,background-color,border-color,box-shadow]",
        "dark:data-unchecked:not-aria-invalid:border-foreground/20",
        "data-unchecked:not-data-disabled:hover:border-primary/60",
        "data-unchecked:not-data-disabled:hover:bg-accent/50",
        "data-unchecked:not-data-disabled:group-hover/checkbox-field:border-primary/60",
        "data-unchecked:not-data-disabled:group-hover/checkbox-field:bg-accent/50",
        "data-checked:not-data-disabled:hover:bg-primary/90",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground",
        "data-checked:animate-[pk-check-pop_220ms_ease-out]",
        "data-indeterminate:animate-[pk-check-pop_220ms_ease-out]",
        "motion-reduce:animate-none!",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
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
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="absolute inset-0 flex items-center justify-center text-current"
            >
                <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={cn(
                        "hidden size-full",
                        "group-data-checked/checkbox:block",
                        "group-data-checked/checkbox:animate-[pk-check-draw_200ms_ease-out_both]",
                        "motion-reduce:animate-none!",
                    )}
                >
                    <path
                        d="M3.6 8.3 6.6 11.4 12.4 4.9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1}
                    />
                </svg>
                <span
                    aria-hidden="true"
                    className={cn(
                        "hidden h-0.5 w-1/2 rounded-full bg-current",
                        "group-data-indeterminate/checkbox:block",
                        "group-data-indeterminate/checkbox:animate-[pk-dash-in_160ms_ease-out_both]",
                        "motion-reduce:animate-none!",
                    )}
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
                "group/checkbox-field flex w-fit items-start gap-2.5 text-sm select-none",
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
                <span className="block leading-5 font-medium">{label}</span>
                {description ? (
                    <span
                        id={descriptionId}
                        className="mt-0.5 block text-sm leading-snug text-muted-foreground"
                    >
                        {description}
                    </span>
                ) : null}
            </span>
        </label>
    );
}

export { Checkbox, CheckboxField, type CheckboxFieldProps, checkboxVariants, type CheckedState };
