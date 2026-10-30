import type * as React from "react";

import { cn } from "../lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "h-8 w-full min-w-0 rounded-md border border-input bg-input-background px-2.5 py-1 text-lg outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
                "aria-invalid:border-destructive aria-invalid:ring-destructive",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
