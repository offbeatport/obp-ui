"use client";

import type { NumberFieldRootChangeEventDetails } from "@base-ui/react/number-field";
import { XIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { InfoTip } from "./info-tip";
import { Label } from "./label";
import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldGroup,
    NumberFieldIncrement,
    NumberFieldInput,
} from "./number-field";
import { Slider } from "./slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type OptionalNumberFieldProps = {
    id: string;
    label: ReactNode;
    help?: ReactNode;
    value: number | null;
    onValueChange: (value: number | null) => void;
    min?: number;
    max?: number;
    step?: number;
    largeStep?: number;
    fallback?: number;
    slider?: boolean;
    format?: Intl.NumberFormatOptions;
    unsetLabel?: string;
    disabled?: boolean;
    className?: string;
};

const STEP_REASONS = new Set(["increment-press", "decrement-press", "wheel", "scrub"]);

function isStep({ reason, event }: NumberFieldRootChangeEventDetails) {
    if (STEP_REASONS.has(reason)) return true;
    return (
        reason === "keyboard" && event instanceof KeyboardEvent && /^Arrow|^Page/.test(event.key)
    );
}

function clamp(value: number, min: number | undefined, max: number | undefined) {
    return Math.min(Math.max(value, min ?? value), max ?? value);
}

function OptionalNumberField({
    id,
    label,
    help,
    value,
    onValueChange,
    min,
    max,
    step = 1,
    largeStep,
    fallback,
    slider,
    format,
    unsetLabel = "Unset",
    disabled = false,
    className,
}: OptionalNumberFieldProps) {
    const input = useRef<HTMLInputElement>(null);
    const named = typeof label === "string" ? label : undefined;
    const labelId = `${id}-label`;
    const resting = clamp(fallback ?? min ?? 0, min, max);
    const showSlider = slider ?? (Number.isFinite(min) && Number.isFinite(max));
    const unset = value === null;

    const typed = (next: number | null, details: NumberFieldRootChangeEventDetails) => {
        onValueChange(unset && next !== null && isStep(details) ? resting : next);
    };

    const clear = () => {
        onValueChange(null);
        input.current?.focus();
    };

    return (
        <div
            data-slot="optional-number-field"
            data-unset={unset ? "" : undefined}
            data-disabled={disabled ? "" : undefined}
            className={cn("group flex w-full min-w-0 flex-col gap-1", className)}
        >
            <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 text-base leading-snug break-words">
                    <Label htmlFor={id} id={labelId} className="inline">
                        {label}
                    </Label>
                    {help ? (
                        <InfoTip
                            label={named ? `About ${named}` : "About this setting"}
                            className="ml-1 align-[-0.1875rem]"
                        >
                            {help}
                        </InfoTip>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <NumberField
                        id={id}
                        value={value}
                        onValueChange={typed}
                        min={min}
                        max={max}
                        step={step}
                        largeStep={largeStep ?? step * 10}
                        format={format}
                        disabled={disabled}
                    >
                        <NumberFieldGroup className="w-30 md:w-24">
                            <NumberFieldDecrement className="w-6" />
                            <NumberFieldInput
                                ref={input}
                                placeholder={unset ? unsetLabel : undefined}
                            />
                            <NumberFieldIncrement className="w-6" />
                        </NumberFieldGroup>
                    </NumberField>
                    {unset ? (
                        <span aria-hidden="true" className="size-7 shrink-0" />
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={named ? `Unset ${named}` : "Unset this setting"}
                                    disabled={disabled}
                                    onClick={clear}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <XIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Unset</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
            {showSlider ? (
                <Slider
                    value={value ?? resting}
                    onValueChange={onValueChange}
                    min={min}
                    max={max}
                    step={step}
                    largeStep={largeStep}
                    format={format}
                    disabled={disabled}
                    muted={unset}
                    aria-labelledby={labelId}
                    aria-valuetext={unset ? unsetLabel : undefined}
                />
            ) : null}
        </div>
    );
}

export { OptionalNumberField, type OptionalNumberFieldProps };
