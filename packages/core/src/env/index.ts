/**
 * Type-safe env-var validation. Apps build their own schema with `createEnv`,
 * which crashes at boot if any required var is missing or wrong-typed -
 * catches "why doesn't it work" errors at app startup rather than at runtime.
 *
 * Re-exports `@t3-oss/env-core` and `zod` so apps have a single import path.
 *
 *   import { createEnv, z } from "@offbeatport/microsaas-core/env";
 *
 *   export const env = createEnv({
 *     server: { DATABASE_URL: z.string().url() },
 *     clientPrefix: "VITE_",
 *     client: { VITE_PUBLIC_URL: z.string().url() },
 *     runtimeEnv: { ...process.env, ...import.meta.env },
 *     emptyStringAsUndefined: true,
 *   });
 */
export { createEnv } from "@t3-oss/env-core";
export { z } from "zod";
