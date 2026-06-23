import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Card } from "@offbeatport/ui/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@offbeatport/ui/ui/avatar";

export interface Testimonial {
  quote: React.ReactNode;
  name: string;
  role?: string;
  /** Avatar image src. Falls back to initials. */
  avatarUrl?: string;
}

export interface TestimonialsProps {
  className?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  items: Testimonial[];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function Testimonials({ className, eyebrow, title, items }: TestimonialsProps) {
  return (
    <section className={cn("px-6 py-20", className)}>
      <div className="max-w-5xl mx-auto">
        {(eyebrow || title) && (
          <div className="text-center mb-12 max-w-xl mx-auto">
            {eyebrow && (
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-3">
                {eyebrow}
              </div>
            )}
            {title && <h2>{title}</h2>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <Card key={i} variant="bordered">
              <blockquote className="text-[15px] leading-[1.55] mb-6">"{t.quote}"</blockquote>
              <div className="flex items-center gap-3">
                <Avatar>
                  {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                  <AvatarFallback>{initials(t.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium leading-tight truncate">{t.name}</div>
                  {t.role && (
                    <div className="text-[12px] text-fg-muted truncate">{t.role}</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
