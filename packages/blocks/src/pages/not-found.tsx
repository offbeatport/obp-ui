import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Button } from "@offbeatport/ui/ui/button";

export interface NotFoundPageProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Render the home button as an `<a href>`, or pass a custom node (e.g. router Link). */
  homeHref?: string;
  homeLabel?: React.ReactNode;
  homeNode?: React.ReactNode;
}

export function NotFoundPage({
  className,
  title = "404",
  description = "We couldn't find that page.",
  homeHref = "/",
  homeLabel = "Go home",
  homeNode,
}: NotFoundPageProps) {
  return (
    <div
      className={cn(
        "min-h-[60vh] flex flex-col items-center justify-center text-center px-6",
        className,
      )}
    >
      <div className="font-display text-[96px] font-light leading-none tracking-[-0.04em] text-fg-subtle">
        {title}
      </div>
      <p className="text-fg-muted text-[15px] leading-[1.55] mt-4 max-w-md">{description}</p>
      <div className="mt-8">
        {homeNode ?? (
          <Button asChild variant="primary">
            <a href={homeHref}>{homeLabel}</a>
          </Button>
        )}
      </div>
    </div>
  );
}
