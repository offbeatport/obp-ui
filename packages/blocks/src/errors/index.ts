import * as Sentry from "@sentry/react";

let initialized = false;

export interface InitSentryOptions {
  /** Override the env-driven DSN. */
  dsn?: string;
  /** Override the env-driven environment (defaults to import.meta.env.MODE). */
  environment?: string;
  /** Trace sample rate. Defaults to 1.0 in dev, 0.2 in prod. */
  tracesSampleRate?: number;
}

export function initSentry(opts: InitSentryOptions = {}) {
  const dsn = opts.dsn ?? import.meta.env.VITE_SENTRY_DSN ?? "";
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: opts.environment ?? import.meta.env.MODE,
    tracesSampleRate: opts.tracesSampleRate ?? (import.meta.env.DEV ? 1.0 : 0.2),
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      if (
        import.meta.env.PROD &&
        event.exception?.values?.[0]?.stacktrace?.frames?.some((f) =>
          f.filename?.includes("extension://"),
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
export const ErrorBoundary = Sentry.ErrorBoundary;
