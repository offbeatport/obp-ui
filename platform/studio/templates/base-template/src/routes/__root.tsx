/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import * as Sentry from "@sentry/react";
import { initSentry } from "../lib/sentry.js";
import { initPostHog, capturePageView } from "../lib/posthog.js";
import globalsCss from "../styles/globals.css?url";

// ── Init integrations (client-side, once) ────────────────────────────────────

function Integrations() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    initSentry();
    initPostHog();
  }, []);

  // Track page views on route change
  useEffect(() => {
    capturePageView();
  }, [pathname]);

  return null;
}

// ── Navigation progress bar ──────────────────────────────────────────────────

function NavProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: isLoading ? 1 : 0,
      }}
    >
      <div
        style={{
          height: "100%",
          width: isLoading ? "75%" : "100%",
          background: "var(--accent)",
          boxShadow: "0 0 8px var(--accent)",
        }}
      />
    </div>
  );
}

// ── Top nav ──────────────────────────────────────────────────────────────────

function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const navLinkStyle = (active: boolean) => ({
    fontSize: "0.875rem",
    fontWeight: active ? 500 : 400,
    color: active ? "var(--fg)" : "var(--fg-subtle)",
    textDecoration: "none",
    padding: "4px 8px",
    borderRadius: "var(--radius)",
    transition: "color 0.15s",
  });

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 52,
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 10, 10, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 8,
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
          marginRight: 16,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            fontWeight: 800,
            color: "#000",
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}
        >
          A
        </div>
        <span
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--fg)",
            letterSpacing: "-0.01em",
          }}
        >
          AppName
        </span>
      </Link>

      {/* Links */}
      <Link to="/" className="nav-link" style={navLinkStyle(pathname === "/")}>
        Home
      </Link>
      <Link
        to="/pricing"
        className="nav-link"
        style={navLinkStyle(pathname === "/pricing")}
      >
        Pricing
      </Link>

      <div style={{ flex: 1 }} />

      {/* Auth */}
      <Link
        to="/dashboard"
        className="nav-link"
        style={navLinkStyle(pathname.startsWith("/dashboard"))}
      >
        Dashboard
      </Link>
      <Link
        to="/login"
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#000",
          textDecoration: "none",
          padding: "6px 14px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
        }}
      >
        Login
      </Link>
    </nav>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AppName" },
      { name: "description", content: "Your app description here." },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
        color: "var(--fg-muted)",
      }}
    >
      <span style={{ fontSize: "3rem", fontWeight: 700, color: "var(--fg-dim)" }}>
        404
      </span>
      <p>Page not found.</p>
      <Link
        to="/"
        style={{
          color: "var(--accent)",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Go home
      </Link>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 16,
            padding: 24,
          }}
        >
          <h2 style={{ color: "var(--danger)" }}>Something went wrong</h2>
          <pre
            style={{
              fontSize: "0.8rem",
              color: "var(--fg-muted)",
              maxWidth: 600,
              overflow: "auto",
            }}
          >
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={resetError}
            style={{
              padding: "8px 20px",
              background: "var(--accent)",
              color: "#000",
              border: "none",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}
    >
      <RootDocument>
        <Integrations />
        <NavProgress />
        <TopNav />
        <main style={{ minHeight: "calc(100vh - 52px)" }}>
          <Outlet />
        </main>
      </RootDocument>
    </Sentry.ErrorBoundary>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'Inter', system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
        }}
      >
        {children}
        <Scripts />
      </body>
    </html>
  );
}
