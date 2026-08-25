// Credentials seam - abstracts *whose keys* run the work, so hosted "managed + metered"
// swaps in behind the same interface. v1 = BYOK from env (the founder's own keys).
//
// Two harness auth modes:
//   subscription - `claude -p` uses the host's ~/.claude login (Max/Pro). No key injected;
//                  cost is reported as an API-equivalent estimate (budget cap is informational).
//   apikey       - an ANTHROPIC_API_KEY / OpenRouter key is injected so spend is real + metered.
import { resolveAgentConfig } from "../../config/agent.js";
import { getSecret } from "../../config/store.js";

export type HarnessMode = "subscription" | "apikey";

export interface Credentials {
    /** env vars injected into the coding-agent subprocess */
    harnessEnv(): Record<string, string>;
}

// DB-backed credentials: env still wins, but keys/config also come from app_config/secret
// (set via Settings/onboarding) and are read lazily per call, so a save applies without a
// daemon restart. (aiProxy/Stripe accessors were removed as dead - re-add behind this seam
// when hosted metering / the payments seam actually land.)
export class DbBackedCredentials implements Credentials {
    harnessEnv(): Record<string, string> {
        const out: Record<string, string> = {};
        const anthropic = process.env.ANTHROPIC_API_KEY ?? getSecret("agent.anthropic_api_key");
        if (anthropic) out.ANTHROPIC_API_KEY = anthropic;
        // GLM-via-claude (advanced): a custom brain base URL routes claude through another provider.
        const cfg = resolveAgentConfig();
        if (cfg.brainProvider === "zai" || cfg.brainProvider === "custom") {
            const base = cfg.brainBaseUrl;
            const token = getSecret("agent.brain_api_key");
            if (base && token) {
                out.ANTHROPIC_BASE_URL = base;
                out.ANTHROPIC_AUTH_TOKEN = token;
            }
        }
        return out;
    }
}
