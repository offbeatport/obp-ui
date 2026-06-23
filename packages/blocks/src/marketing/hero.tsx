import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Button } from "@offbeatport/ui/ui/button";

export interface HeroProps {
  className?: string;
  /** Optional eyebrow above the title (e.g. "New" / "Public beta"). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Primary CTA. Pass either `ctaHref` or `ctaOnClick`. */
  ctaLabel?: React.ReactNode;
  ctaHref?: string;
  ctaOnClick?: () => void;
  /** Secondary action (e.g. "Watch demo"). */
  secondaryLabel?: React.ReactNode;
  secondaryHref?: string;
  secondaryOnClick?: () => void;
  /** Reassurance line under the CTAs (e.g. "No card required · Free forever"). */
  reassurance?: React.ReactNode;
  /** Right-side content (illustration, screenshot, video). When omitted, hero centers. */
  visual?: React.ReactNode;
}

export function Hero({
  className,
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  secondaryLabel,
  secondaryHref,
  secondaryOnClick,
  reassurance,
  visual,
}: HeroProps) {
  return (
    <section
      className={cn(
        "px-6 py-20 md:py-28",
        visual ? "" : "text-center",
        className,
      )}
    >
      <div
        className={cn(
          "max-w-5xl mx-auto",
          visual && "grid grid-cols-1 md:grid-cols-2 gap-12 items-center",
        )}
      >
        <div className={cn(visual ? "" : "max-w-3xl mx-auto")}>
          {eyebrow && (
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-4">
              {eyebrow}
            </div>
          )}
          <h1
            className={cn(
              "font-display font-light leading-[1.05] tracking-[-0.03em]",
              visual ? "text-[44px] md:text-[56px]" : "text-[44px] md:text-[64px]",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-fg-muted text-[16px] md:text-[18px] leading-[1.55] mt-6 max-w-2xl">
              {subtitle}
            </p>
          )}
          {(ctaLabel || secondaryLabel) && (
            <div
              className={cn(
                "flex flex-wrap gap-3 mt-8",
                !visual && "justify-center",
              )}
            >
              {ctaLabel &&
                (ctaHref ? (
                  <Button asChild variant="primary" size="lg">
                    <a href={ctaHref}>{ctaLabel}</a>
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={ctaOnClick}>
                    {ctaLabel}
                  </Button>
                ))}
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
          )}
          {reassurance && (
            <p className="text-[13px] text-fg-subtle mt-4 font-mono">{reassurance}</p>
          )}
        </div>
        {visual && <div>{visual}</div>}
      </div>
    </section>
  );
}
