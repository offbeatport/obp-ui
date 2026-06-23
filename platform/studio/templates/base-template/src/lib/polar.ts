import { Polar } from "@polar-sh/sdk";

// ── Server-side Polar client ─────────────────────────────────────────────────
// Import this only in server functions / API routes, never in client bundles.

let _polar: Polar | null = null;

export function getPolarClient(): Polar {
  if (!_polar) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("POLAR_ACCESS_TOKEN is not set");
    }
    _polar = new Polar({ accessToken });
  }
  return _polar;
}

// ── Checkout helpers ──────────────────────────────────────────────────────────

export interface CheckoutOptions {
  productId: string;
  /** Return URL after successful payment */
  successUrl: string;
  /** User email to pre-fill */
  customerEmail?: string;
  /** Arbitrary metadata to attach */
  metadata?: Record<string, string | number | boolean>;
}

export async function createCheckoutUrl(opts: CheckoutOptions): Promise<string> {
  const polar = getPolarClient();

  const checkout = await polar.checkouts.create({
    productId: opts.productId,
    successUrl: opts.successUrl,
    customerEmail: opts.customerEmail,
    metadata: opts.metadata,
  });

  return checkout.url;
}

// ── Webhook verification ──────────────────────────────────────────────────────

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Polar uses HMAC-SHA256; verify before processing
  // In production, use @polar-sh/sdk's built-in webhook handler:
  // import { validateEvent } from "@polar-sh/sdk/webhooks"
  try {
    const { createHmac } = require("crypto") as typeof import("crypto");
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return signature === `sha256=${expected}`;
  } catch {
    return false;
  }
}

// ── Product catalog (static IDs from env) ────────────────────────────────────

export function getProductIds(): string[] {
  const ids = process.env.POLAR_PRODUCT_IDS || "";
  return ids.split(",").map((s) => s.trim()).filter(Boolean);
}
