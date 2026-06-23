import posthog from "posthog-js";

let initialized = false;

export interface InitPostHogOptions {
  /** Override the env-driven key (e.g. for SSR or per-app keys). */
  key?: string;
  /** Override the env-driven host. */
  host?: string;
  /** Capture pageviews automatically. Default false - call `capturePageView()` on route change. */
  autoPageview?: boolean;
}

export function initPostHog(opts: InitPostHogOptions = {}) {
  const key = opts.key ?? import.meta.env.VITE_POSTHOG_KEY ?? "";
  const host = opts.host ?? import.meta.env.VITE_POSTHOG_HOST ?? "https://app.posthog.com";

  if (!key || initialized || typeof window === "undefined") return;

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: opts.autoPageview ?? false,
    capture_pageleave: true,
    loaded(ph) {
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialized = true;
}

export function capturePageView() {
  if (initialized) posthog.capture("$pageview");
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (initialized) posthog.identify(userId, properties);
}

export function resetIdentity() {
  if (initialized) posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (initialized) posthog.capture(event, properties);
}

export { posthog };
