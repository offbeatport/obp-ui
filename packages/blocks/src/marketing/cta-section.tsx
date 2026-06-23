import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Button } from "@offbeatport/ui/ui/button";

export interface CTASectionProps {
  className?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaLabel: React.ReactNode;
  ctaHref?: string;
  ctaOnClick?: () => void;
  secondaryLabel?: React.ReactNode;
  secondaryHref?: string;
  secondaryOnClick?: () => void;
  reassurance?: React.ReactNode;
}

export function CTASection({
  className,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  secondaryLabel,
  secondaryHref,
  secondaryOnClick,
  reassurance,
}: CTASectionProps) {
  return (
    <section className={cn("px-6 py-20", className)}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="mb-3">{title}</h2>
        {subtitle && (
          <p className="text-fg-muted text-[15px] leading-[1.55] mb-8 max-w-xl mx-auto">
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          {ctaHref ? (
            <Button asChild variant="primary" size="lg">
              <a href={ctaHref}>{ctaLabel}</a>
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={ctaOnClick}>
              {ctaLabel}
            </Button>
          )}
          {secondaryLabel &&
            (secondaryHref ? (
              <Button asChild variant="secondary" size="lg">
                <a href={secondaryHref}>{secondaryLabel}</a>
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={secondaryOnClick}>
                {secondaryLabel}
              </Button>
            ))}
        </div>
        {reassurance && (
          <p className="text-[13px] text-fg-subtle mt-5 font-mono">{reassurance}</p>
        )}
      </div>
    </section>
  );
}
