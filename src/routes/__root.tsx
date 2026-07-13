/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeToggle } from "../components/theme-toggle";
import globalsCss from "../styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "C Slop Slop" },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap",
      },
    ],
    // apply the persisted theme before first paint (no flash of the wrong theme)
    scripts: [
      {
        children:
          "try{if(localStorage.getItem('cslopslop-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
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
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-sans)",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <div style={{ flex: 1 }}>{children}</div>
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4 text-xs text-muted-foreground">
        <span>
          <span className="text-primary">{"{"}</span> C Slop Slop{" "}
          <span className="text-primary">{"}"}</span> — from a thought to bag.
        </span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
