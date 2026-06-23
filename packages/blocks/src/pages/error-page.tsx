import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Button } from "@offbeatport/ui/ui/button";

export interface ErrorPageProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Underlying error to surface in a debug `<pre>`. */
  error?: unknown;
  /** Retry handler - renders a "Try again" button. */
  onRetry?: () => void;
  /** "Go home" link target. */
  homeHref?: string;
}

export function ErrorPage({
  className,
  title = "Something went wrong",
  description = "We hit an unexpected error. We've been notified.",
  error,
  onRetry,
  homeHref = "/",
}: ErrorPageProps) {
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
      className={cn(
        "min-h-[60vh] flex flex-col items-center justify-center text-center px-6",
        className,
      )}
    >
      <div className="font-display text-[64px] font-light leading-none tracking-[-0.03em] text-danger">
        500
      </div>
      <h1 className="text-[24px] mt-4">{title}</h1>
      <p className="text-fg-muted text-[14px] leading-[1.55] mt-2 max-w-md">{description}</p>
      {message && (
        <pre className="text-[12px] text-fg-muted bg-field border border-border rounded-sm px-3 py-2 max-w-xl overflow-auto mt-6 font-mono whitespace-pre-wrap">
          {message}
        </pre>
      )}
      <div className="mt-8 flex gap-3 flex-wrap justify-center">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button asChild variant="secondary">
          <a href={homeHref}>Go home</a>
        </Button>
      </div>
    </div>
  );
}
