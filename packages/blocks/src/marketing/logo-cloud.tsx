import * as React from "react";
import { cn } from "@offbeatport/core/utils";

export interface LogoCloudProps {
  className?: string;
  /** Optional eyebrow line (e.g. "Trusted by teams at"). */
  eyebrow?: React.ReactNode;
  /**
   * Logos as React nodes (typically inline SVGs sized ~24-32px tall).
   * They render as `text-fg-muted` so SVGs that use `currentColor` blend
   * with the surrounding text. For colored logos, set explicit `fill`.
   */
  logos: React.ReactNode[];
}

export function LogoCloud({ className, eyebrow, logos }: LogoCloudProps) {
  return (
    <section className={cn("px-6 py-12 border-y border-border", className)}>
      <div className="max-w-5xl mx-auto">
        {eyebrow && (
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-8">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-fg-muted opacity-80">
          {logos.map((logo, i) => (
            <div key={i} className="h-7 flex items-center [&>svg]:h-7 [&>svg]:w-auto">
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
