import * as React from "react";
import { cn } from "@offbeatport/core/utils";

export interface SettingsLayoutProps {
  className?: string;
  /** Section navigation. Apps pass router-aware links - typically a vertical list. */
  nav: React.ReactNode;
  /** Page title shown above the content. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Two-column settings layout: 200px nav on the left, content on the right,
 * with a centered max-width so long forms stay readable. Drop into any
 * authenticated route under a settings hierarchy.
 */
export function SettingsLayout({
  className,
  nav,
  title,
  description,
  children,
}: SettingsLayoutProps) {
  return (
    <div className={cn("max-w-5xl mx-auto px-6 py-12", className)}>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10">
        <aside className="md:border-r md:border-border md:pr-6">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">{nav}</nav>
        </aside>
        <div className="min-w-0">
          {(title || description) && (
            <header className="mb-8 pb-6 border-b border-border">
              {title && <h1 className="text-[28px] mb-1">{title}</h1>}
              {description && <p className="text-fg-muted text-[14px]">{description}</p>}
            </header>
          )}
          <div className="flex flex-col gap-12">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* Helper for the section nav items - drop-in styled link button.
 * Apps using TanStack Router can wrap this with their own `<Link>`. */
export interface SettingsNavItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}

export const SettingsNavItem = React.forwardRef<HTMLAnchorElement, SettingsNavItemProps>(
  ({ className, active, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "px-3 py-2 text-[13px] rounded-sm whitespace-nowrap md:whitespace-normal",
        active ? "bg-hover text-fg font-medium" : "text-fg-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  ),
);
SettingsNavItem.displayName = "SettingsNavItem";

/* Section heading for a settings panel (e.g. "Profile", "Billing"). */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <header>
        <h2 className="text-[18px] mb-1">{title}</h2>
        {description && <p className="text-fg-muted text-[13px]">{description}</p>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
