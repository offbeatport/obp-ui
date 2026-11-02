import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { selectTriggerVariants } from "./select";

type CheckboxSelectOption = {
    value: string;
    label: React.ReactNode;
    text?: string;
    count?: number;
};

type CheckboxSelectProps = {
    label: string;
    allLabel: string;
    noun: string;
    options: CheckboxSelectOption[];
    value: string[];
    onValueChange: (value: string[]) => void;
    size?: "sm" | "default" | "lg";
    className?: string;
};

function summary(options: CheckboxSelectOption[], value: string[], allLabel: string, noun: string) {
    const chosen = options.filter((option) => value.includes(option.value));
    if (chosen.length === 0 || chosen.length === options.length) {
        return allLabel;
    }
    const [only] = chosen;
    if (chosen.length === 1 && only) {
        return only.text ?? (typeof only.label === "string" ? only.label : only.value);
    }
    return `${chosen.length} ${noun}`;
}

function CheckboxSelect({
    label,
    allLabel,
    noun,
    options,
    value,
    onValueChange,
    size = "default",
    className,
}: CheckboxSelectProps) {
    const toggle = (option: string, on: boolean) =>
        onValueChange(
            on
                ? options
                      .map((item) => item.value)
                      .filter((item) => item === option || value.includes(item))
                : value.filter((item) => item !== option),
        );
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    data-slot="checkbox-select"
                    className={cn(selectTriggerVariants({ size }), "w-auto min-w-40", className)}
                >
                    <span className="truncate">{summary(options, value, allLabel, noun)}</span>
                    <ChevronDownIcon className="size-4 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
                <fieldset aria-label={label} className="flex flex-col">
                    {options.map((option) => (
                        <Label
                            key={option.value}
                            className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 font-normal hover:bg-secondary"
                        >
                            <Checkbox
                                checked={value.includes(option.value)}
                                onCheckedChange={(next) => toggle(option.value, next === true)}
                            />
                            <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            {option.count !== undefined && (
                                <span className="text-sm text-muted-foreground tabular-nums">
                                    {option.count}
                                </span>
                            )}
                        </Label>
                    ))}
                </fieldset>
                {value.length > 0 && (
                    <div className="mt-1 border-t pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => onValueChange([])}
                        >
                            {`Show ${allLabel.toLowerCase()}`}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

export { CheckboxSelect, type CheckboxSelectOption, type CheckboxSelectProps };
