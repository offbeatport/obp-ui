import { Polar } from "@polar-sh/sdk";

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

export interface CheckoutOptions {
  productId: string;
  successUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string | number | boolean>;
}

export async function createCheckoutUrl(opts: CheckoutOptions): Promise<string> {
  const polar = getPolarClient();
  const checkout = await polar.checkouts.create({
    products: [opts.productId],
    successUrl: opts.successUrl,
    customerEmail: opts.customerEmail,
    metadata: opts.metadata,
  });
  return checkout.url;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const provided = signature.replace(/^sha256=/, "");
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getProductIds(): string[] {
  const ids = process.env.POLAR_PRODUCT_IDS || "";
  return ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
