import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || "";
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Send 100% of transactions in dev, 20% in production
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      // Drop errors from browser extensions in prod
      if (
        import.meta.env.PROD &&
        event.exception?.values?.[0]?.stacktrace?.frames?.some(
          (f) => f.filename?.includes("extension://")
        )
      ) {
        return null;
      }
      return event;
    },
  });

  initialized = true;
}

export { Sentry };
