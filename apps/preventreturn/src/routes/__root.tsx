/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Footer } from "@offbeatport/ui/ui/footer";
import { Toaster } from "sonner";
import { type ReactNode } from "react";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PreventReturn - Stop returns before they happen" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || (to !== "/app" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`text-sm px-2 py-1 rounded transition-colors ${active ? "text-fg font-medium" : "text-fg-muted hover:text-fg"}`}
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button type="button" onClick={signOut} className="text-xs text-fg-muted hover:text-fg transition-colors">
      Sign out
    </button>
  );
}

const APP_FOOTER = (
  <Footer
    brandName="PreventReturn"
    tagline="The AI agent that stops Shopify returns before they happen."
    columns={[
      {
        title: "Product",
        links: [
          { label: "Dashboard", href: "/app" },
          { label: "Settings", href: "/settings" },
          { label: "Pricing", href: "/pricing" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy policy", href: "/privacy" },
          { label: "Terms of service", href: "/terms" },
        ],
      },
    ]}
    legal={[
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ]}
  />
);

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 h-[52px] border-b border-border bg-bg/85 backdrop-blur flex items-center px-6 gap-6 shrink-0">
        <div className="flex items-center gap-2 mr-2 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="rgb(var(--primary-fg))" strokeWidth="1.5" fill="none" />
                <circle cx="7" cy="7" r="2" fill="rgb(var(--primary-fg))" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight text-fg text-sm">PreventReturn</span>
          </Link>
        </div>
        <nav className="flex items-center gap-1 flex-1">
          <NavLink to="/app">Dashboard</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <UserMenu />
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      {APP_FOOTER}
    </div>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 h-[52px] flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 mr-auto">
          <span className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="rgb(var(--primary-fg))" strokeWidth="1.5" fill="none" />
              <circle cx="7" cy="7" r="2" fill="rgb(var(--primary-fg))" />
            </svg>
          </span>
          <span className="font-semibold tracking-tight text-fg text-sm">PreventReturn</span>
        </Link>
        <NavLink to="/pricing">Pricing</NavLink>
        <NavLink to="/login">Sign in</NavLink>
        <Link to="/app" className="text-sm font-semibold text-primary-fg bg-primary rounded px-4 py-1.5 hover:brightness-110 transition">
          Get started
        </Link>
      </div>
    </header>
  );
}

function MarketingShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      {APP_FOOTER}
    </div>
  );
}

function AuthShell() {
  return (
    <div className="min-h-screen bg-bg">
      <Outlet />
    </div>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStandalone = pathname === "/";
  const isAuth = pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password";
  const isMarketing = pathname === "/pricing" || pathname === "/privacy" || pathname === "/terms";

  return (
    <RootDocument>
      {isStandalone ? <Outlet /> : isAuth ? <AuthShell /> : isMarketing ? <MarketingShell /> : <AppShell />}
      <Toaster position="bottom-right" />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
{children}
        <Scripts />
      </body>
    </html>
  );
}
