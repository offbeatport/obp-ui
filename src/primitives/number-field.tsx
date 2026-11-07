"use client";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

import type { StringClassName } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

const PAGE_KEYS: Record<string, string> = { PageUp: "ArrowUp", PageDown: "ArrowDown" };

type InputProps = StringClassName<ComponentProps<typeof NumberFieldPrimitive.Input>>;
type InputKeyDown = Parameters<NonNullable<InputProps["onKeyDown"]>>[0];

type NumberFieldProps = StringClassName<Omit<NumberFieldPrimitive.Root.Props, "render">> & {
    unit?: ReactNode;
    groupClassName?: string;
    inputClassName?: string;
    placeholder?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
    children?: ReactNode;
};

function NumberField({
    className,
    children,
    unit,
    groupClassName,
    inputClassName,
    placeholder,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...props
}: NumberFieldProps) {
    const unitId = useId();
    const describedBy = [ariaDescribedBy, unit ? unitId : undefined].filter(Boolean).join(" ");
    return (
        <NumberFieldPrimitive.Root
            data-slot="number-field"
            className={cn("inline-flex items-center gap-2", className)}
            {...props}
        >
            {children ?? (
                <>
                    <NumberFieldGroup className={groupClassName}>
                        <NumberFieldDecrement />
                        <NumberFieldInput
                            placeholder={placeholder}
                            aria-label={ariaLabel}
                            aria-labelledby={ariaLabelledBy}
                            aria-describedby={describedBy || undefined}
                            aria-invalid={ariaInvalid}
                            className={inputClassName}
                        />
                        <NumberFieldIncrement />
                    </NumberFieldGroup>
                    {unit ? (
                        <span
                            id={unitId}
                            data-slot="number-field-unit"
                            className="text-sm text-muted-foreground"
                        >
                            {unit}
                        </span>
                    ) : null}
                </>
            )}
        </NumberFieldPrimitive.Root>
    );
}

function NumberFieldGroup({
    className,
    ...props
}: StringClassName<ComponentProps<typeof NumberFieldPrimitive.Group>>) {
    return (
        <NumberFieldPrimitive.Group
            data-slot="number-field-group"
            className={cn(
                "flex h-8 w-32 items-stretch overflow-hidden rounded-md border border-input bg-input-background",
                "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-ring",
                "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive",
                "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function NumberFieldInput({ className, onKeyDown, ...props }: InputProps) {
    const stepByPage = (event: InputKeyDown) => {
        onKeyDown?.(event);
        const key = PAGE_KEYS[event.key];
        if (!key || event.defaultPrevented) return;
        event.preventDefault();
        event.currentTarget.dispatchEvent(
            new globalThis.KeyboardEvent("keydown", {
                key,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );
    };
    return (
        <NumberFieldPrimitive.Input
            data-slot="number-field-input"
            onKeyDown={stepByPage}
            className={cn(
                "h-full w-full min-w-0 flex-1 bg-transparent px-1 text-center font-sans text-lg tabular-nums outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-base",
                className,
            )}
            {...props}
        />
    );
}

const stepperClassName =
    "flex w-8 shrink-0 cursor-pointer items-center justify-center border-input text-muted-foreground outline-none select-none not-data-disabled:hover:bg-secondary not-data-disabled:hover:text-foreground data-disabled:cursor-not-allowed data-disabled:[&_svg]:opacity-40";

function NumberFieldDecrement({
    className,
    children,
    ...props
}: StringClassName<ComponentProps<typeof NumberFieldPrimitive.Decrement>>) {
    return (
        <NumberFieldPrimitive.Decrement
            data-slot="number-field-decrement"
            className={cn(stepperClassName, "border-r", className)}
            {...props}
        >
            {children ?? <MinusIcon aria-hidden="true" className="size-3.5" />}
        </NumberFieldPrimitive.Decrement>
    );
}

function NumberFieldIncrement({
    className,
    children,
    ...props
}: StringClassName<ComponentProps<typeof NumberFieldPrimitive.Increment>>) {
    return (
        <NumberFieldPrimitive.Increment
            data-slot="number-field-increment"
            className={cn(stepperClassName, "border-l", className)}
            {...props}
        >
            {children ?? <PlusIcon aria-hidden="true" className="size-3.5" />}
        </NumberFieldPrimitive.Increment>
    );
}

export {
    NumberField,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
    type NumberFieldProps,
};
