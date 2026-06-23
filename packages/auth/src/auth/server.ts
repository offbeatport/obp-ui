import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authSchema } from "@offbeatport/db/schema/auth";

export interface CreateAuthOptions {
  /** Drizzle DB instance from `createDb()`. */
  db: Parameters<typeof drizzleAdapter>[0];
  /** Public base URL of the app (e.g. https://app.example.com). */
  baseURL?: string;
  /** Auth secret (≥ 32 chars). Read from BETTER_AUTH_SECRET if omitted. */
  secret?: string;
  /** Enable email + password sign-in. Default: true. */
  emailAndPassword?: boolean;
  /** Require email verification. Default: false. */
  requireEmailVerification?: boolean;
  /** OAuth providers. Pass empty/omit to disable. */
  socialProviders?: BetterAuthOptions["socialProviders"];
  /** Session config. Defaults to 30-day expiry, 1-day refresh, 5-min cookie cache. */
  session?: BetterAuthOptions["session"];
  /** Extra trusted origins beyond the baseURL. */
  trustedOrigins?: string[];
  /** Pass-through escape hatch for any better-auth option not listed above. */
  extra?: Partial<BetterAuthOptions>;
}

export function createAuth(opts: CreateAuthOptions) {
  const baseURL = opts.baseURL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  const secret = opts.secret ?? process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production";

  return betterAuth({
    database: drizzleAdapter(opts.db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    baseURL,
    secret,
    emailAndPassword: {
      enabled: opts.emailAndPassword ?? true,
      requireEmailVerification: opts.requireEmailVerification ?? false,
    },
    socialProviders: opts.socialProviders,
    session: opts.session ?? {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    trustedOrigins: [baseURL, ...(opts.trustedOrigins ?? [])],
    ...opts.extra,
  });
}

export type CoreAuth = ReturnType<typeof createAuth>;
