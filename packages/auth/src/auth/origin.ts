/**
 * Cross-origin defense for state-changing endpoints.
 *
 * SameSite=Lax cookies (better-auth's default) protect most cookie-borne
 * cross-site requests, but a `fetch` from another origin can still POST
 * to your endpoints with no cookies - and if your handler doesn't require
 * a session (e.g. anon-tier `/api/run`), that POST will succeed and burn
 * your AI quota. The origin check refuses any request whose Origin /
 * Referer doesn't match an allowed list.
 *
 * Browsers always set `Origin` on cross-origin POSTs. Same-origin POSTs
 * may or may not set it (depends on browser); when missing, fall back
 * to `Referer`. For non-browser clients (curl, server-to-server) the
 * caller chooses whether to allow them via `allowMissing`.
 */

export interface AssertSameOriginOptions {
  request: Request;
  /**
   * Allowed origins, e.g. `["https://taglines.example"]`. The request's
   * own origin (derived from `request.url`) is ALWAYS allowed in
   * addition to this list - so behind a reverse proxy that rewrites the
   * URL correctly you don't need to repeat it here.
   */
  allowed?: string[];
  /**
   * If true, requests with no Origin AND no Referer pass. Use this for
   * server-to-server endpoints where you trust other auth (e.g. webhook
   * signatures). Default: false (browser clients only).
   */
  allowMissing?: boolean;
}

export class OriginRejectedError extends Error {
  readonly status = 403;
  constructor(reason: string) {
    super(reason);
    this.name = "OriginRejectedError";
  }
}

/**
 * Throws `OriginRejectedError` if the request's Origin/Referer doesn't
 * match `allowed` (or the request's own origin). Returns silently on
 * success - chain it before the work happens.
 */
export function assertSameOrigin(opts: AssertSameOriginOptions): void {
  const requestOrigin = safeOrigin(opts.request.url);
  const allowed = new Set(
    [requestOrigin, ...(opts.allowed ?? [])].filter(Boolean) as string[],
  );

  const origin = opts.request.headers.get("origin");
  if (origin) {
    if (!allowed.has(origin)) {
      throw new OriginRejectedError(`origin not allowed: ${origin}`);
    }
    return;
  }

  const referer = opts.request.headers.get("referer");
  if (referer) {
    const refererOrigin = safeOrigin(referer);
    if (!refererOrigin || !allowed.has(refererOrigin)) {
      throw new OriginRejectedError(`referer not allowed: ${referer}`);
    }
    return;
  }

  if (!opts.allowMissing) {
    throw new OriginRejectedError("missing Origin and Referer headers");
  }
}

function safeOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
