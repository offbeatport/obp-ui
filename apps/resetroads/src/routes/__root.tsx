/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { ErrorBoundary, initSentry } from "@offbeatport/blocks/errors";
import { NotFoundPage } from "@offbeatport/blocks/pages/not-found";
import { ErrorPage } from "@offbeatport/blocks/pages/error-page";
import { ThemeScript } from "@offbeatport/blocks/theme";
import { type ReactNode, useEffect } from "react";
import appCss from "../styles/app.css?url";

function Integrations() {
  useEffect(() => {
    initSentry();
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ResetRoads - Honest career reads for people who just got laid off" },
      {
        name: "description",
        content:
          "Upload your CV. AI models debate your next career move. Free, no sign-in required.",
      },
      { property: "og:title", content: "ResetRoads" },
      {
        property: "og:description",
        content: "Upload your CV. Get an honest read on your next move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;450;500;600&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,wght@0,400;1,400&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <NotFoundPage
      homeNode={
        <Link to="/" className="text-primary font-medium text-sm hover:underline">
          Go home
        </Link>
      }
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
        <Outlet />
        <footer className="footer">
          <div>RESETROADS · A FREE CAREER TOOL</div>
          <div>NO MARKET DATA · NO FAKE SCORES</div>
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
