import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  const key = import.meta.env.VITE_POSTHOG_KEY || "";
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";
  if (!key || initialized || typeof window === "undefined") return;

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false, // we do this manually on route change
    capture_pageleave: true,
    loaded(ph) {
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialized = true;
}

/** Call on every route change */
export function capturePageView() {
  if (initialized) {
    posthog.capture("$pageview");
  }
}

/** Identify a user after login */
export function identify(userId: string, properties?: Record<string, unknown>) {
  if (initialized) {
    posthog.identify(userId, properties);
  }
}

/** Reset on logout */
export function resetIdentity() {
  if (initialized) {
    posthog.reset();
  }
}

export { posthog };
