import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type * as React from "react";
import { cn } from "../lib/cn";

export type SortDirection = "asc" | "desc" | false;

export function sortAria(direction: SortDirection) {
    if (direction === "asc") {
        return "ascending" as const;
    }
    return direction === "desc" ? ("descending" as const) : undefined;
}

export type SortButtonProps = Omit<React.ComponentProps<"button">, "type"> & {
    direction: SortDirection;
};

function SortButton({ direction, className, children, ...props }: SortButtonProps) {
    return (
        <button
            type="button"
            data-slot="sort-button"
            data-sorted={direction || undefined}
            className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                className,
            )}
            {...props}
        >
            <span className="truncate">{children}</span>
            {direction === "asc" && (
                <IconChevronUp aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            {direction === "desc" && (
                <IconChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            {direction && (
                <span className="sr-only">
                    {direction === "asc" ? ", sorted ascending" : ", sorted descending"}
                </span>
            )}
        </button>
    );
}

export { SortButton };
