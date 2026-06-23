import { createHmac } from "node:crypto";
import { env } from "./env";

const SCOPES = "read_orders,write_orders,read_customers,read_products";

export function buildInstallUrl(shop: string, state: string): string {
  const redirectUri = `${env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const params = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    "grant_options[]": "per-user",
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

export function verifyHmac(query: URLSearchParams): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return false;
  const params = new URLSearchParams(query);
  params.delete("hmac");
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", env.SHOPIFY_API_SECRET).update(message).digest("hex");
  return digest === hmac;
}

export function verifyWebhookHmac(rawBody: string, shopifyHmac: string): boolean {
  const digest = createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");
  return digest === shopifyHmac;
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export function normalizeShopDomain(shop: string): string {
  return shop.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\s+/g, "").toLowerCase();
}
