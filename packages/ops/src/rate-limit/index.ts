import type Database from "better-sqlite3";

export { usageDay, USAGE_DAY_SQL, usageSchema } from "./schema";

/**
 * UTC date as YYYY-MM-DD. Reset boundary for daily quotas.
 */
export function todayUTC(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface ResolveOwnerKeyOptions {
  /** Logged-in user id; takes precedence over cookies/IP. */
  userId?: string | null;
  /** Incoming request. Used to read the anon cookie / fallback to IP. */
  request: Request;
  /** Name of the anon-id cookie. Default: "anon_id". */
  anonCookieName?: string;
}

/**
 * Pick the most specific stable identity available for rate-limiting.
 *
 * Order: logged-in user → anon cookie → forwarded IP → "ip:unknown".
 *
 * Apps that want anon limiting must also call `getOrSetAnonCookie` on
 * the response to mint the cookie when one isn't present yet.
 */
export function resolveOwnerKey(opts: ResolveOwnerKeyOptions): string {
  if (opts.userId) return `u:${opts.userId}`;

  const cookieName = opts.anonCookieName ?? "anon_id";
  const cookieHeader = opts.request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|; )${escapeRe(cookieName)}=([^;]+)`).exec(cookieHeader);
  if (match) return `a:${match[1]}`;

  const fwd = opts.request.headers.get("x-forwarded-for");
  const ip = (fwd?.split(",")[0] || opts.request.headers.get("x-real-ip") || "").trim();
  if (ip) return `ip:${ip}`;

  return "ip:unknown";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface AnonCookieOptions {
  request: Request;
  /** Mutable headers to append set-cookie to (e.g. `new Headers()` you'll attach to the Response). */
  responseHeaders: Headers;
  cookieName?: string;
  /** Cookie max-age in seconds. Default: 1 year. */
  maxAgeSeconds?: number;
}

/**
 * Read the anon cookie if present, otherwise mint a UUID and queue a
 * Set-Cookie on `responseHeaders`. Returns the value either way.
 */
export function getOrSetAnonCookie(opts: AnonCookieOptions): string {
  const cookieName = opts.cookieName ?? "anon_id";
  const cookieHeader = opts.request.headers.get("cookie") ?? "";
  const match = new RegExp(`(?:^|; )${escapeRe(cookieName)}=([^;]+)`).exec(cookieHeader);
  if (match) return match[1];

  const id = crypto.randomUUID();
  const maxAge = opts.maxAgeSeconds ?? 60 * 60 * 24 * 365;
  opts.responseHeaders.append(
    "set-cookie",
    `${cookieName}=${id}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`,
  );
  return id;
}

export interface RateLimitOptions {
  /** better-sqlite3 Database. From `createDb()`'s `sqlite` field. */
  sqlite: Database.Database;
  /** Owner key (use `resolveOwnerKey`). */
  ownerKey: string;
  /** Daily limit. count > limit → not allowed. */
  limit: number;
  /** UTC YYYY-MM-DD. Defaults to today. */
  day?: string;
  /** Whether to record this hit. Default: true. Set false to peek. */
  increment?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  limit: number;
  /** Start of the next UTC day - when the counter resets. */
  resetAt: Date;
}

/**
 * Atomic increment + check against a daily limit. Uses SQLite UPSERT,
 * so concurrent requests can't double-spend the quota.
 *
 * Requires the `usage_day` table - include `USAGE_DAY_SQL` in your
 * `createDb({ extraMigrations })`.
 */
export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const day = opts.day ?? todayUTC();
  const increment = opts.increment ?? true;

  let count: number;
  if (increment) {
    const id = crypto.randomUUID();
    const row = opts.sqlite
      .prepare(/* sql */ `
        INSERT INTO usage_day (id, owner_key, day, count) VALUES (?, ?, ?, 1)
        ON CONFLICT(owner_key, day) DO UPDATE SET count = count + 1
        RETURNING count
      `)
      .get(id, opts.ownerKey, day) as { count: number };
    count = row.count;
  } else {
    const row = opts.sqlite
      .prepare(/* sql */ `
        SELECT count FROM usage_day WHERE owner_key = ? AND day = ?
      `)
      .get(opts.ownerKey, day) as { count: number } | undefined;
    count = row?.count ?? 0;
  }

  const allowed = count <= opts.limit;
  const remaining = Math.max(0, opts.limit - count);

  const [y, m, d] = day.split("-").map(Number);
  const resetAt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 1));

  return { allowed, count, remaining, limit: opts.limit, resetAt };
}

export type Tier = "anon" | "free" | "paid";

export interface TierLimits {
  anon: number;
  free: number;
  paid: number;
}

/**
 * Sane factory defaults: 3 anon / 10 free / 1000 paid per day. Apps
 * should pass their own `TierLimits` matching their pricing page copy.
 */
export const DEFAULT_TIER_LIMITS: TierLimits = {
  anon: 3,
  free: 10,
  paid: 1000,
};

export interface TieredRateLimitOptions
  extends Omit<RateLimitOptions, "limit"> {
  tier: Tier;
  limits?: TierLimits;
}

export function checkTieredRateLimit(
  opts: TieredRateLimitOptions,
): RateLimitResult & { tier: Tier } {
  const limits = opts.limits ?? DEFAULT_TIER_LIMITS;
  const result = checkRateLimit({ ...opts, limit: limits[opts.tier] });
  return { ...result, tier: opts.tier };
}
