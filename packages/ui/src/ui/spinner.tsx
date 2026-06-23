import * as React from "react";
import { cn } from "../utils/cn";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  /** When true, the spinner takes the brand color; otherwise it inherits text color. */
  brand?: boolean;
}

const sizes = {
  sm: "w-3 h-3 border-[1.5px]",
  md: "w-4 h-4 border-2",
  lg: "w-6 h-6 border-2",
} as const;

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", brand = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn(
          "inline-block rounded-full border-current border-r-transparent animate-[spin_1s_linear_infinite]",
          sizes[size],
          brand && "text-primary",
          className,
        )}
        {...props}
      />
    );
  },
);
Spinner.displayName = "Spinner";
