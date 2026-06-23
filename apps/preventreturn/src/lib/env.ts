const required = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DATABASE_URL",
] as const;

const optional = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "OPENROUTER_API_KEY",
  "RESEND_API_KEY",
] as const;

function validateEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

if (typeof window === "undefined") {
  validateEnv();
}

export const env = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
  DATABASE_URL: process.env.DATABASE_URL!,
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ?? "",
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ?? "",
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? "http://localhost:3005",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
} as const;
