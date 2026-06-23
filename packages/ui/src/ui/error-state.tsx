import * as React from "react";
import { cn } from "../utils/cn";

export interface ErrorStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Surface the underlying error message in a `<pre>` for debug visibility. */
  error?: unknown;
  /** Action to retry / recover. */
  action?: React.ReactNode;
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title = "Something went wrong", description, error, action, ...props }, ref) => {
    const message =
      error === undefined
        ? null
        : error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center text-center py-16 px-6",
          "border border-danger/30 bg-danger/5 rounded-md",
          className,
        )}
        {...props}
      >
        <h3 className="mb-2 text-danger max-w-sm">{title}</h3>
        {description && (
          <p className="text-fg-muted text-[14px] leading-[1.6] max-w-md mb-4">{description}</p>
        )}
        {message && (
          <pre className="text-[12px] text-fg-muted bg-field border border-border rounded-sm px-3 py-2 max-w-xl overflow-auto mb-4 font-mono whitespace-pre-wrap">
            {message}
          </pre>
        )}
        {action}
      </div>
    );
  },
);
ErrorState.displayName = "ErrorState";
