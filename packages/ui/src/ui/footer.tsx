import * as React from "react";
import { cn } from "../utils/cn";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  /** Brand name shown in the lockup. */
  brandName: string;
  /** One-line tagline below the brand. Optional. */
  tagline?: string;
  /** Link columns (Product, Company, Resources, etc.). Each renders as a column. */
  columns?: FooterColumn[];
  /** Bottom-row legal links (Privacy, Terms, Cookies, etc.). */
  legal?: FooterLink[];
  /** Optional social-icon row (SVGs as React nodes). */
  social?: React.ReactNode;
  /** Override the displayed copyright year. Defaults to the current year. */
  year?: number;
  className?: string;
}

export function Footer({
  brandName,
  tagline,
  columns = [],
  legal = [],
  social,
  year = new Date().getFullYear(),
  className,
}: FooterProps) {
  return (
    <footer
      className={cn(
        "border-t border-border bg-bg",
        "px-6 pt-12 pb-8",
        className,
      )}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className={cn(
            "grid gap-10 mb-12",
            columns.length === 0 && "grid-cols-1",
            columns.length === 1 && "grid-cols-1 md:grid-cols-[2fr_1fr]",
            columns.length === 2 && "grid-cols-1 md:grid-cols-[2fr_1fr_1fr]",
            columns.length === 3 && "grid-cols-1 md:grid-cols-[2fr_repeat(3,1fr)]",
            columns.length >= 4 && "grid-cols-1 md:grid-cols-[2fr_repeat(4,1fr)]",
          )}
        >
          <div>
            <div className="font-display font-medium text-[18px] tracking-tight">
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 -translate-y-[2px]" />
              {brandName}
            </div>
            {tagline && (
              <p className="text-fg-muted text-[13px] leading-[1.5] mt-2 max-w-xs">{tagline}</p>
            )}
            {social && <div className="flex gap-3 mt-4">{social}</div>}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle mb-3">
                {col.title}
              </div>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-fg-muted hover:text-fg"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <span className="font-mono text-[11px] text-fg-subtle">
            © {year} {brandName}. All rights reserved.
          </span>
          {legal.length > 0 && (
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              {legal.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-mono text-[11px] text-fg-subtle hover:text-fg"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
