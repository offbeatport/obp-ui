import { createAuthClient } from "better-auth/react";

export interface CreateAuthClientOptions {
  /** Public base URL. Defaults to window.location.origin (browser) or BETTER_AUTH_URL. */
  baseURL?: string;
}

export function createCoreAuthClient(opts: CreateAuthClientOptions = {}) {
  const baseURL =
    opts.baseURL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : (process.env.BETTER_AUTH_URL ?? "http://localhost:3000"));

  return createAuthClient({ baseURL });
}

export type CoreAuthClient = ReturnType<typeof createCoreAuthClient>;
