"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { useCallback } from "react";

import { cn } from "../lib/cn";

type SliderProps = {
    value: number;
    onValueChange: (value: number) => void;
    onValueCommitted?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    largeStep?: number;
    format?: Intl.NumberFormatOptions;
    disabled?: boolean;
    muted?: boolean;
    id?: string;
    name?: string;
    className?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-valuetext"?: string;
};

function firstValue(value: number | readonly number[]) {
    return typeof value === "number" ? value : (value[0] ?? 0);
}

function useInputId(id: string | undefined) {
    return useCallback(
        (input: HTMLInputElement | null) => {
            if (input && id) input.id = id;
        },
        [id],
    );
}

function Slider({
    value,
    onValueChange,
    onValueCommitted,
    min = 0,
    max = 100,
    step = 1,
    largeStep,
    format,
    disabled = false,
    muted = false,
    id,
    name,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-valuetext": ariaValueText,
}: SliderProps) {
    const inputRef = useInputId(id);
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            data-muted={muted ? "" : undefined}
            value={value}
            onValueChange={(next) => onValueChange(firstValue(next))}
            onValueCommitted={
                onValueCommitted ? (next) => onValueCommitted(firstValue(next)) : undefined
            }
            min={min}
            max={max}
            step={step}
            largeStep={largeStep ?? step * 10}
            format={format}
            disabled={disabled}
            name={name}
            thumbAlignment="edge"
            className={cn(
                "group/slider w-full min-w-0 data-disabled:cursor-not-allowed data-disabled:opacity-50",
                className,
            )}
        >
            <SliderPrimitive.Control
                data-slot="slider-control"
                className="flex h-5 w-full touch-none items-center select-none group-data-disabled/slider:pointer-events-none"
            >
                <SliderPrimitive.Track
                    data-slot="slider-track"
                    className="h-1 w-full rounded-sm bg-secondary inset-ring inset-ring-border select-none"
                >
                    {muted ? null : (
                        <SliderPrimitive.Indicator
                            data-slot="slider-range"
                            className="rounded-sm bg-primary select-none"
                        />
                    )}
                    <SliderPrimitive.Thumb
                        data-slot="slider-thumb"
                        inputRef={inputRef}
                        aria-label={ariaLabel}
                        aria-labelledby={ariaLabelledBy}
                        aria-describedby={ariaDescribedBy}
                        aria-valuetext={ariaValueText}
                        className={cn(
                            "size-3.5 cursor-grab rounded-full border border-input bg-card select-none data-dragging:cursor-grabbing",
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background",
                            "group-data-muted/slider:bg-secondary",
                        )}
                    />
                </SliderPrimitive.Track>
            </SliderPrimitive.Control>
        </SliderPrimitive.Root>
    );
}

export { Slider, type SliderProps };
