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
import { Settings } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { LogoMark } from "../components/logo-mark";
import { STYLE_PRESETS, RADIUS_PRESETS, hexToTriplet } from "@offbeatport/core/theme/styles";
import { ThemeToggle, ThemeScript, useTheme } from "@offbeatport/blocks/theme";
import { UserMenu } from "@offbeatport/blocks/auth/user-menu";
import appCss from "../styles/app.css?url";
import { signOut, useSession } from "../lib/auth-client";

// ─── Owner-only style picker ──────────────────────────────────────────────────

const DEV_EMAIL = "hello@offbeatport.com";
const STYLE_LS_KEY = "reportfuse-devstyle";
type DevStyle = { style: string; radius: string };
const DEFAULT_DEV_STYLE: DevStyle = { style: "Emerald", radius: "Sharp" };

function isDarkNow(): boolean {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDevStyle(s: DevStyle) {
  const preset = STYLE_PRESETS.find((p) => p.name === s.style);
  const radius = RADIUS_PRESETS.find((r) => r.name === s.radius);
  const dark = isDarkNow();
  const root = document.documentElement;
  if (preset) {
    const v = dark ? preset.dark : preset.light;
    root.style.setProperty("--primary", hexToTriplet(v.primary));
    root.style.setProperty("--primary-fg", hexToTriplet(v.primaryFg));
    root.style.setProperty("--bg", hexToTriplet(v.bg));
  }
  if (radius) {
    root.style.setProperty("--r-sm", `${radius.sm}px`);
    root.style.setProperty("--r-md", `${radius.md}px`);
  }
}

function loadDevStyle(): DevStyle {
  try {
    const s = localStorage.getItem(STYLE_LS_KEY);
    if (s) return JSON.parse(s) as DevStyle;
  } catch {}
  return DEFAULT_DEV_STYLE;
}

function StylePicker({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<DevStyle>(DEFAULT_DEV_STYLE);
  const { theme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadDevStyle();
    setCurrent(saved);
    applyDevStyle(saved);
  }, []);

  useEffect(() => {
    if (email !== DEV_EMAIL) return;
    applyDevStyle(current);
  }, [current, theme, email]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (email !== DEV_EMAIL) return null;

  function pick(update: Partial<DevStyle>) {
    const next = { ...current, ...update };
    setCurrent(next);
    localStorage.setItem(STYLE_LS_KEY, JSON.stringify(next));
  }

  const activePreset = STYLE_PRESETS.find((p) => p.name === current.style);
  const swatchHex = activePreset?.light.primary ?? "#047857";
  const swatchRgb = hexToTriplet(swatchHex).replace(/ /g, ",");

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 hover:bg-hover transition-colors"
        title="Dev: style picker"
      >
        <span className="w-3 h-3 rounded-full" style={{ background: `rgb(${swatchRgb})`, boxShadow: `0 0 0 1.5px rgb(${swatchRgb} / 0.3)` }} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-[9999] bg-bg border border-border p-4 shadow-lg" style={{ width: 288 }}>
          <p className="font-mono text-[10px] text-fg-subtle uppercase tracking-widest mb-3">Style</p>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {STYLE_PRESETS.map((p) => {
              const rgb = hexToTriplet(p.light.primary).replace(/ /g, ",");
              const active = current.style === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  title={p.name}
                  onClick={() => pick({ style: p.name })}
                  className="w-9 h-9 transition-transform hover:scale-110"
                  style={{
                    background: `rgb(${rgb})`,
                    outline: active ? `2px solid rgb(${rgb})` : "none",
                    outlineOffset: active ? "2px" : "0",
                  }}
                />
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-fg-subtle uppercase tracking-widest mb-2">Radius</p>
          <div className="flex gap-1.5 mb-4">
            {RADIUS_PRESETS.map((r) => {
              const active = current.radius === r.name;
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => pick({ radius: r.name })}
                  className={`flex-1 text-[10px] font-mono py-1.5 border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-fg-muted hover:text-fg"}`}
                  style={{ borderRadius: r.sm === 999 ? "999px" : `${r.sm}px` }}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="font-mono text-[10px] text-fg-subtle">{current.style} / {current.radius}</span>
            <button
              type="button"
              onClick={() => pick(DEFAULT_DEV_STYLE)}
              className="font-mono text-[10px] text-fg-subtle hover:text-fg transition-colors"
            >
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div className="h-full bg-primary shadow-[0_0_8px_var(--primary)]" style={{ width: "75%" }} />
    </div>
  );
}

function TopNav() {
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 h-[60px] border-b border-border bg-bg/90 backdrop-blur flex items-center px-8 gap-3">
      <Link to="/" className="flex items-center gap-2.5 mr-6">
        <LogoMark size={30} />
        <span className="font-display font-light text-fg tracking-tight hidden sm:block" style={{ fontSize: "1.05rem", letterSpacing: "-0.02em" }}>
          Report<span className="text-primary">Fuse</span>
        </span>
      </Link>

      <Link to="/pricing" className="text-sm text-fg-muted hover:text-fg transition-colors px-2">
        Pricing
      </Link>

      <div className="flex-1" />

      <StylePicker email={session?.user.email ?? ""} />
      <ThemeToggle />

      {session ? (
        <UserMenu
          user={session.user}
          onSignOut={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
          links={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings",  href: "/dashboard/settings", icon: <Settings size={13} className="text-fg-muted" /> },
          ]}
        />
      ) : (
        <Link
          to="/login"
          className="ml-1 text-sm font-medium text-primary-fg bg-primary border border-primary px-5 py-2 hover:brightness-110"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ReportFuse" },
      { name: "description", content: "Drop CSVs from any marketing platform. AI maps columns semantically and outputs one clean merged table." },
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-fg-muted">
      <span className="font-display text-[64px] font-light text-fg-subtle leading-none">404</span>
      <p>Page not found.</p>
      <Link to="/" className="text-primary font-medium">Go home</Link>
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
            className="px-4 py-[10px] text-sm font-medium text-white bg-primary border border-primary hover:brightness-110"
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
        <main className="min-h-[calc(100vh-60px)]">
          <Outlet />
        </main>
      </RootDocument>
    </ErrorBoundary>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body>{children}<Scripts /></body>
    </html>
  );
}
