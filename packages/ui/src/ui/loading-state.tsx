import * as React from "react";
import { cn } from "../utils/cn";
import { Spinner } from "./spinner";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  /** When true, fills the parent (use inside layout containers). Default: padded inline. */
  fill?: boolean;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, label = "Loading…", fill = false, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-fg-muted",
        fill ? "min-h-[200px] py-10" : "py-12",
        className,
      )}
      {...props}
    >
      <Spinner size="md" brand />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  ),
);
LoadingState.displayName = "LoadingState";
