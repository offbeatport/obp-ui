/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { capturePageView, initPostHog } from "@offbeatport/ops/analytics";
import { ErrorBoundary, initSentry } from "@offbeatport/blocks/errors";
import { NotFoundPage } from "@offbeatport/blocks/pages/not-found";
import { ErrorPage } from "@offbeatport/blocks/pages/error-page";
import { UserMenu } from "@offbeatport/blocks/auth/user-menu";
import { ThemeToggle, ThemeScript } from "@offbeatport/blocks/theme";
import { Footer } from "@offbeatport/ui/ui/footer";
import { type ReactNode, useEffect } from "react";
import appCss from "../styles/app.css?url";
import { useSession, signOut } from "../lib/auth-client";

function Integrations() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    initSentry();
    initPostHog();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fire on route change.
  useEffect(() => {
    capturePageView();
  }, [pathname]);

  return null;
}

function NavProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-0.5 pointer-events-none transition-opacity"
      style={{ opacity: isLoading ? 1 : 0 }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)]"
        style={{ width: "75%" }}
      />
    </div>
  );
}

function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: session } = useSession();

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center",
      height: 52, padding: "0 20px",
      background: "var(--lb-bg)",
      borderBottom: "1px solid var(--lb-border)",
      gap: 24,
    }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <span style={{
          width: 18, height: 18, background: "var(--lb-azure)",
          position: "relative", flexShrink: 0, display: "inline-block",
        }} />
        <span style={{
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          fontWeight: 600, fontSize: 15,
          letterSpacing: "-0.01em",
          color: "var(--lb-fg)",
        }}>
          LiveAIPulse
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 12 }}>
        {[
          { to: "/", label: "Leaderboard", exact: true },
          { to: "/how-it-works", label: "How it works", exact: false },
          { to: "/blog", label: "Blog", exact: false },
        ].map(({ to, label, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{
                padding: "6px 10px",
                fontSize: 13,
                color: active ? "var(--lb-fg)" : "var(--lb-fg-2)",
                background: active ? "var(--lb-bg-2)" : "transparent",
                textDecoration: "none",
                fontWeight: 450,
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <ThemeToggle />

      {session?.user && (
        <UserMenu
          user={session.user}
          onSignOut={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
          links={[{ label: "Admin", href: "/admin" }]}
        />
      )}
    </nav>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LiveAIPulse - AI Shopping Rankings" },
      { name: "description", content: "See which Shopify stores AI recommends most. Rankings updated weekly across 21 shopping categories." },
      { property: "og:title", content: "LiveAIPulse - AI Shopping Rankings" },
      { property: "og:description", content: "Which Shopify stores do AI models recommend most? Updated weekly across 21 categories." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://liveaipulse.com" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "LiveAIPulse - AI Shopping Rankings" },
      { name: "twitter:description", content: "Which Shopify stores do AI models recommend most?" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;450;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <NotFoundPage
      homeNode={<Link to="/" className="text-primary font-medium text-sm hover:underline">Go home</Link>}
    />
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorPage error={error} onRetry={resetError} />
      )}
    >
      <RootDocument>
        <Integrations />
        <NavProgress />
        <TopNav />
        <main className="min-h-[calc(100vh-52px)]">
          <Outlet />
        </main>
        <footer style={{ borderTop: "1px solid var(--lb-border)", padding: "24px 0 32px", marginTop: 48 }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 14, background: "var(--lb-azure)", display: "inline-block" }} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--lb-fg)" }}>LiveAIPulse</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", marginLeft: 8 }}>
                Daily AI shopping rankings
              </span>
            </div>
            <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <ThemeToggle />
              {[
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
              ].map(({ label, href }) => (
                <a key={href} href={href} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", textDecoration: "none" }}>
                  {label}
                </a>
              ))}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-4)" }}>
                © {new Date().getFullYear()} LiveAIPulse
              </span>
              <Link
                to="/login"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-4)", textDecoration: "none" }}
              >
                Admin
              </Link>
            </nav>
          </div>
        </footer>
      </RootDocument>
    </ErrorBoundary>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
