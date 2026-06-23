export type RiskSignal = {
  label: string;
  severity: "high" | "medium" | "low";
  weight: number;
};

export type RiskResult = {
  score: number;
  signals: RiskSignal[];
};

export type ShopifyOrderPayload = {
  id: number;
  order_number: number;
  email?: string;
  phone?: string;
  created_at: string;
  total_price: string;
  currency: string;
  customer?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    orders_count: number;
    total_spent: string;
  };
  billing_address?: { zip?: string; country_code?: string };
  shipping_address?: { zip?: string; country_code?: string };
  line_items: Array<{
    id: number;
    title: string;
    variant_title?: string;
    sku?: string;
    quantity: number;
    price: string;
    product_id: number;
    variant_id: number;
  }>;
  gateway?: string;
  checkout_token?: string;
  tags?: string;
};

export type MerchantHistoryContext = {
  // How many times this buyer has previously returned
  buyerReturnCount: number;
  // How many previous orders this buyer has (0 = first time)
  buyerOrderCount: number;
  // Historical return rate for this SKU (0–1)
  skuReturnRate: Record<string, number>;
  // Average order value for this buyer
  buyerAverageOrderValue: number;
};

export function scoreOrder(
  order: ShopifyOrderPayload,
  history: MerchantHistoryContext,
): RiskResult {
  const signals: RiskSignal[] = [];
  const orderValue = parseFloat(order.total_price);
  const placedAt = new Date(order.created_at);
  const hour = placedAt.getHours();

  // 1. Bracketing - same product ordered in multiple variants/sizes
  const productGroups: Record<number, number> = {};
  for (const item of order.line_items) {
    productGroups[item.product_id] = (productGroups[item.product_id] ?? 0) + 1;
  }
  const hasBracketing = Object.values(productGroups).some((count) => count > 1);
  if (hasBracketing) {
    signals.push({ label: "Multiple sizes/variants of same product ordered", severity: "high", weight: 35 });
  }

  // 2. First-time buyer
  const isFirstTime = (order.customer?.orders_count ?? 0) <= 1 || history.buyerOrderCount === 0;
  if (isFirstTime) {
    signals.push({ label: "First-time buyer", severity: "high", weight: 20 });
  }

  // 3. Late-night purchase (10 PM – 4 AM)
  if (hour >= 22 || hour <= 4) {
    signals.push({ label: `Late-night purchase (${placedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`, severity: "medium", weight: 12 });
  }

  // 4. High-return SKU
  for (const item of order.line_items) {
    const sku = item.sku ?? String(item.variant_id);
    const rate = history.skuReturnRate[sku] ?? 0;
    if (rate >= 0.3) {
      signals.push({ label: `${item.title} has a ${Math.round(rate * 100)}% return rate`, severity: "medium", weight: 15 });
      break;
    }
  }

  // 5. Gift order (ship-to ≠ billing)
  const billingZip = order.billing_address?.zip;
  const shippingZip = order.shipping_address?.zip;
  if (billingZip && shippingZip && billingZip !== shippingZip) {
    signals.push({ label: "Shipping to different address - possible gift", severity: "medium", weight: 10 });
  }

  // 6. Serial returner
  if (history.buyerReturnCount >= 2) {
    signals.push({ label: `Buyer has returned ${history.buyerReturnCount} previous orders`, severity: "high", weight: 25 });
  }

  // 7. High AOV vs buyer average
  if (
    history.buyerAverageOrderValue > 0 &&
    orderValue > history.buyerAverageOrderValue * 1.8
  ) {
    signals.push({ label: "Order value significantly above buyer's average", severity: "low", weight: 8 });
  }

  // 8. Apparel / footwear category (high-return categories)
  const highReturnTitles = order.line_items.filter((item) =>
    /blazer|jacket|dress|shoe|sneaker|boot|jeans|trouser|suit|jogger|legging|top|skirt|coat/i.test(item.title),
  );
  if (highReturnTitles.length > 0 && !signals.find((s) => s.label.includes("return rate"))) {
    signals.push({ label: "Apparel/footwear - above-average return category", severity: "low", weight: 8 });
  }

  const rawScore = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(100, Math.round(rawScore));

  return { score, signals };
}

export function shouldIntervene(
  score: number,
  orderValue: number,
  settings: { riskThreshold: number; minOrderValue: number; agentEnabled: boolean },
): boolean {
  return settings.agentEnabled && score >= settings.riskThreshold && orderValue >= settings.minOrderValue;
}
