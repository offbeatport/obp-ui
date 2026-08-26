"use client";

import { type VariantProps, cva } from "class-variance-authority";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { type ComponentProps, type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

// The corner is derived from --radius rather than taken from `rounded-sm`: at 16-20px the kit's
// small radius token (8px) rounds a checkbox into a radio. Deriving it keeps a rebranded company
// (which only overrides --radius) in step, without hardcoding a value.
const checkboxVariants = cva(
    [
        "peer group/checkbox relative inline-flex shrink-0 items-center justify-center",
        // bg-card carries both themes on its own: a `dark:` override here would out-sort the
        // checked fill below and leave a ticked box unpainted in dark.
        "rounded-[calc(var(--radius)/3)] border border-input bg-card shadow-xs outline-none",
        "transition-[color,background-color,border-color,box-shadow]",
        // On dark paper the --input hairline all but vanishes at 20px, so an empty box gets a
        // slightly brighter line there. State-scoped, so it can never fight the checked border.
        "dark:data-[state=unchecked]:not-aria-invalid:border-foreground/20",
        // An empty box has to read as something you can hit - from the box itself, and from
        // anywhere on a CheckboxField row (that row is the group).
        "data-[state=unchecked]:enabled:hover:border-primary/60",
        "data-[state=unchecked]:enabled:hover:bg-accent/50",
        "data-[state=unchecked]:enabled:group-hover/checkbox-field:border-primary/60",
        "data-[state=unchecked]:enabled:group-hover/checkbox-field:bg-accent/50",
        "data-[state=checked]:enabled:hover:bg-primary/90",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        // A short squash as it fills, so ticking reads as a press rather than a repaint.
        "data-[state=checked]:animate-[pk-check-pop_220ms_ease-out]",
        "data-[state=indeterminate]:animate-[pk-check-pop_220ms_ease-out]",
        "motion-reduce:animate-none!",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    ],
    {
        variants: {
            size: {
                // default matches one line of `text-sm` (20px), so a field row aligns with no nudge.
                default: "size-5",
                sm: "size-4",
            },
        },
        defaultVariants: {
            size: "default",
        },
    },
);

type CheckedState = CheckboxPrimitive.CheckedState;

function Checkbox({
    className,
    size = "default",
    ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & VariantProps<typeof checkboxVariants>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            data-size={size}
            className={cn(checkboxVariants({ size, className }))}
            {...props}
        >
            {/* Radix only mounts the indicator once checked/indeterminate; which of the two glyphs
                shows is driven off the root's data-state, so switching between them re-triggers
                the animation instead of hard-swapping. */}
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
                        "group-data-[state=checked]/checkbox:block",
                        // pathLength=1 normalises the geometry, so one keyframe draws any tick.
                        "group-data-[state=checked]/checkbox:animate-[pk-check-draw_200ms_ease-out_both]",
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
                        "group-data-[state=indeterminate]/checkbox:block",
                        "group-data-[state=indeterminate]/checkbox:animate-[pk-dash-in_160ms_ease-out_both]",
                        "motion-reduce:animate-none!",
                    )}
                />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

type CheckboxFieldProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> &
    VariantProps<typeof checkboxVariants> & {
        /** The clickable text. Rendered inside the row's own <label>, so never pass an element. */
        label: ReactNode;
        /** Optional second line, wired to the box with aria-describedby. */
        description?: ReactNode;
        /** Classes for the box; `className` styles the row. */
        checkboxClassName?: string;
    };

/**
 * Checkbox + label (+ description) as one hit target. This is what app code should reach for:
 * a column of these lines up because every row owns the same geometry.
 */
function CheckboxField({
    id,
    label,
    description,
    className,
    checkboxClassName,
    size = "default",
    disabled,
    ...props
}: CheckboxFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const descriptionId = description ? `${fieldId}-description` : undefined;

    return (
        // The row IS the label: htmlFor plus nesting makes the whole row clickable, and the HTML
        // spec skips label forwarding for clicks that land on interactive content, so hitting the
        // box itself still toggles exactly once. The text is a <span>, not the Label primitive -
        // a <label> inside a <label> is invalid.
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
