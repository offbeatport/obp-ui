import * as React from "react";
import { cn } from "@offbeatport/core/utils";

export interface FeatureGridItem {
  /** Icon node (e.g. lucide-react icon ~24px). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
}

export interface FeatureGridProps {
  className?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  items: FeatureGridItem[];
  /** Default 3. Pass 2 or 4 for different cadences. */
  columns?: 2 | 3 | 4;
}

const colMap = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

export function FeatureGrid({
  className,
  eyebrow,
  title,
  subtitle,
  items,
  columns = 3,
}: FeatureGridProps) {
  return (
    <section className={cn("px-6 py-20", className)}>
      <div className="max-w-5xl mx-auto">
        {(eyebrow || title || subtitle) && (
          <div className="text-center mb-12 max-w-xl mx-auto">
            {eyebrow && (
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-3">
                {eyebrow}
              </div>
            )}
            {title && <h2 className="mb-3">{title}</h2>}
            {subtitle && <p className="text-fg-muted leading-[1.55]">{subtitle}</p>}
          </div>
        )}
        <div className={cn("grid grid-cols-1 gap-x-8 gap-y-10", colMap[columns])}>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-3">
              {item.icon && <div className="text-primary [&_svg]:w-6 [&_svg]:h-6">{item.icon}</div>}
              <h3 className="text-[16px]">{item.title}</h3>
              <p className="text-[14px] text-fg-muted leading-[1.6]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
