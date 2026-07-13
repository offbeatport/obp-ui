// Credentials seam — abstracts *whose keys* run the work, so hosted "managed + metered"
// swaps in behind the same interface. v1 = BYOK from env (the founder's own keys).
//
// Two harness auth modes:
//   subscription — `claude -p` uses the host's ~/.claude login (Max/Pro). No key injected;
//                  cost is reported as an API-equivalent estimate (budget cap is informational).
//   apikey       — an ANTHROPIC_API_KEY / OpenRouter key is injected so spend is real + metered.
export type HarnessMode = "subscription" | "apikey";

export interface Credentials {
  readonly mode: HarnessMode;
  /** env vars injected into the coding-agent subprocess */
  harnessEnv(): Record<string, string>;
  /** key for the AI proxy (scoring/planning/drafting) — OpenRouter by default */
  aiProxyKey(): string | undefined;
  aiProxyBaseUrl(): string;
  /** Stripe test-mode secret (payments seam, wired later) */
  stripeTestKey(): string | undefined;
}

export class EnvCredentials implements Credentials {
  readonly mode: HarnessMode;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.mode = env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY ? "apikey" : "subscription";
  }

  harnessEnv(): Record<string, string> {
    const out: Record<string, string> = {};
    // subscription mode injects nothing — claude uses the host login.
    if (this.env.ANTHROPIC_API_KEY) out.ANTHROPIC_API_KEY = this.env.ANTHROPIC_API_KEY;
    return out;
  }

  aiProxyKey(): string | undefined {
    return this.env.OPENROUTER_API_KEY ?? this.env.ANTHROPIC_API_KEY;
  }

  aiProxyBaseUrl(): string {
    return this.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  }

  stripeTestKey(): string | undefined {
    return this.env.STRIPE_TEST_SECRET_KEY;
  }
}
