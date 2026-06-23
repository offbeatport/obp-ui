const SHOPIFY_API_VERSION = "2024-10";

async function shopifyFetch<T>(
  accessToken: string,
  shopDomain: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getShopInfo(accessToken: string, shopDomain: string) {
  const data = await shopifyFetch<{ shop: Record<string, unknown> }>(
    accessToken, shopDomain, "shop.json",
  );
  return data.shop;
}

export async function getOrder(accessToken: string, shopDomain: string, orderId: string) {
  const data = await shopifyFetch<{ order: Record<string, unknown> }>(
    accessToken, shopDomain, `orders/${orderId}.json`,
  );
  return data.order;
}

export async function cancelOrder(accessToken: string, shopDomain: string, orderId: string, reason = "customer") {
  return shopifyFetch(accessToken, shopDomain, `orders/${orderId}/cancel.json`, "POST", { reason });
}

export async function updateOrderNote(accessToken: string, shopDomain: string, orderId: string, note: string) {
  return shopifyFetch(accessToken, shopDomain, `orders/${orderId}.json`, "PUT", { order: { id: orderId, note } });
}

export async function getOrderCount(accessToken: string, shopDomain: string, email: string) {
  const data = await shopifyFetch<{ count: number }>(
    accessToken, shopDomain, `orders/count.json?email=${encodeURIComponent(email)}&status=any`,
  );
  return data.count;
}

export async function registerWebhook(accessToken: string, shopDomain: string, topic: string, address: string) {
  return shopifyFetch(
    accessToken, shopDomain, "webhooks.json", "POST",
    { webhook: { topic, address, format: "json" } },
  );
}

export async function getProductMetafields(accessToken: string, shopDomain: string, productId: string) {
  const data = await shopifyFetch<{ metafields: Array<Record<string, unknown>> }>(
    accessToken, shopDomain, `products/${productId}/metafields.json`,
  );
  return data.metafields;
}
