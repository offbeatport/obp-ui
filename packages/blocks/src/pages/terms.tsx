import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { type LegalCopyVars, TERMS_SECTIONS, fillSections } from "./legal-content";

export interface TermsOfServiceProps extends LegalCopyVars {
  className?: string;
  /** App-specific clauses appended after the standard sections. */
  additionalSections?: Array<{ title: string; body: React.ReactNode }>;
}

export function TermsOfService({
  className,
  additionalSections = [],
  ...vars
}: TermsOfServiceProps) {
  const sections = fillSections(TERMS_SECTIONS, vars);
  return (
    <article className={cn("max-w-2xl mx-auto px-6 py-16", className)}>
      <header className="mb-12 pb-6 border-b border-border">
        <h1 className="mb-2">Terms of service</h1>
        {vars.effectiveDate && (
          <p className="text-fg-muted text-[13px]">
            Effective {vars.effectiveDate}
          </p>
        )}
      </header>
      {sections.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="mb-3">{s.title}</h2>
          <p className="text-fg-muted leading-[1.6]">{s.body}</p>
        </section>
      ))}
      {additionalSections.map((s, i) => (
        <section key={`extra-${i}`} className="mb-8">
          <h2 className="mb-3">{s.title}</h2>
          <div className="text-fg-muted leading-[1.6]">{s.body}</div>
        </section>
      ))}
    </article>
  );
}
