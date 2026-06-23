/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { capturePageView, initPostHog } from "@offbeatport/microsaas-core/analytics";
import { ErrorBoundary, initSentry } from "@offbeatport/microsaas-core/errors";
import { type ReactNode, useEffect } from "react";
import appCss from "../styles/app.css?url";

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

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Tagline Generator" },
      {
        name: "description",
        content: "Generate 5 compelling taglines for any product - instantly, for free.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-fg-muted">
      <span className="font-display text-[64px] font-light leading-none">404</span>
      <p>Page not found.</p>
      <a href="/" className="text-primary font-medium">Go home</a>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
          <h2 className="text-danger text-xl font-semibold">Something went wrong</h2>
          <pre className="text-xs text-fg-muted max-w-xl overflow-auto">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            type="button"
            onClick={resetError}
            className="px-4 py-2.5 text-sm font-medium text-white bg-primary rounded hover:brightness-110"
          >
            Try again
          </button>
        </div>
      )}
    >
      <RootDocument>
        <Integrations />
        <Outlet />
      </RootDocument>
    </ErrorBoundary>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
