import type * as React from "react";

import { cn } from "../lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            aria-hidden="true"
            className={cn(
                "rounded-md bg-muted animate-pulse motion-reduce:animate-none",
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
