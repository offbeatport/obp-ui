import * as React from "react";
import { cn } from "@offbeatport/core/utils";

export interface DashboardLayoutProps {
  className?: string;
  /** Brand lockup (logo + name) on the left of the topnav. */
  brand: React.ReactNode;
  /** Topnav links (typically `<Link>` instances from your router). */
  nav?: React.ReactNode;
  /** Right-side content - usually a user avatar dropdown + upgrade button. */
  user?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-page layout: sticky 52px topnav + main content. Used by every
 * authenticated screen across most archetypes.
 */
export function DashboardLayout({
  className,
  brand,
  nav,
  user,
  children,
}: DashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen flex flex-col", className)}>
      <header className="sticky top-0 z-40 h-[52px] border-b border-border bg-bg/85 backdrop-blur flex items-center px-6 gap-6">
        <div className="flex items-center gap-2 mr-2 shrink-0">{brand}</div>
        {nav && <nav className="flex items-center gap-1 flex-1 min-w-0">{nav}</nav>}
        {user && <div className="flex items-center gap-2 ml-auto">{user}</div>}
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
