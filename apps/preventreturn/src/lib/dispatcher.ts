import { db } from "../db/client";
import { orders, interventions, messages, merchants, merchantSettings } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { scoreOrder, shouldIntervene, type ShopifyOrderPayload } from "./risk";
import { generateInterventionMessage } from "./message-generator";
import { sendSMS } from "./sms";
import { sendEmail, buildInterventionEmailHtml } from "./email";
import { randomUUID } from "node:crypto";

export async function processNewOrder(
  merchantId: string,
  shopifyPayload: ShopifyOrderPayload,
): Promise<void> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
  });
  if (!merchant) throw new Error(`Merchant ${merchantId} not found`);

  const settings = await db.query.merchantSettings.findFirst({
    where: eq(merchantSettings.merchantId, merchantId),
  });

  const effectiveSettings = {
    riskThreshold: settings?.riskThreshold ?? 70,
    minOrderValue: settings?.minOrderValue ?? 40,
    agentEnabled: merchant.agentEnabled,
    channelSms: settings?.channelSms ?? true,
    channelEmail: settings?.channelEmail ?? false,
    tone: (settings?.tone ?? "helpful") as "helpful" | "concise" | "premium",
    excludeGifts: settings?.excludeGifts ?? false,
    excludeSale: settings?.excludeSale ?? true,
  };

  // Build history context (simplified - extend later with real queries)
  const orderValue = parseFloat(shopifyPayload.total_price);
  const history = {
    buyerReturnCount: 0,
    buyerOrderCount: shopifyPayload.customer?.orders_count ?? 0,
    skuReturnRate: {},
    buyerAverageOrderValue: parseFloat(shopifyPayload.customer?.total_spent ?? "0") /
      Math.max(1, shopifyPayload.customer?.orders_count ?? 1),
  };

  const { score, signals } = scoreOrder(shopifyPayload, history);
  const firstItem = shopifyPayload.line_items[0];
  const productName = firstItem?.title ?? "your order";
  const buyerName = shopifyPayload.customer
    ? `${shopifyPayload.customer.first_name} ${shopifyPayload.customer.last_name}`.trim()
    : "Customer";
  const buyerFirstName = shopifyPayload.customer?.first_name ?? "there";

  // Upsert order row
  const orderId = randomUUID();
  await db.insert(orders).values({
    id: orderId,
    merchantId,
    shopifyOrderId: String(shopifyPayload.id),
    shopifyOrderNumber: String(shopifyPayload.order_number),
    buyerName,
    buyerEmail: shopifyPayload.email ?? shopifyPayload.customer?.email,
    buyerPhone: shopifyPayload.phone ?? shopifyPayload.customer?.phone,
    productName,
    productSku: firstItem?.sku,
    orderValue,
    currency: shopifyPayload.currency,
    riskScore: score,
    riskSignals: signals,
    isFirstTimebuyer: history.buyerOrderCount <= 1,
    status: "watching",
    shopifyPayload: shopifyPayload as unknown as Record<string, unknown>,
    placedAt: new Date(shopifyPayload.created_at),
  }).onConflictDoNothing();

  if (!shouldIntervene(score, orderValue, effectiveSettings)) return;

  // Determine channel
  const channel = effectiveSettings.channelSms ? "sms" : effectiveSettings.channelEmail ? "email" : null;
  if (!channel) return;

  const recipientAddress = channel === "sms"
    ? (shopifyPayload.phone ?? shopifyPayload.customer?.phone ?? "")
    : (shopifyPayload.email ?? shopifyPayload.customer?.email ?? "");

  if (!recipientAddress) return;

  // Generate message
  const messageBody = await generateInterventionMessage({
    productName,
    signals,
    channel,
    tone: effectiveSettings.tone,
    buyerFirstName,
  });

  // Create intervention row
  const interventionId = randomUUID();
  await db.insert(interventions).values({
    id: interventionId,
    orderId,
    merchantId,
    channel,
    recipientAddress,
    outcome: "awaiting",
    sentAt: new Date(),
  });

  // Create first message row
  await db.insert(messages).values({
    id: randomUUID(),
    interventionId,
    from: "agent",
    body: messageBody,
    sentAt: new Date(),
  });

  // Send
  if (channel === "sms") {
    const sid = await sendSMS(recipientAddress, messageBody);
    await db.update(messages)
      .set({ externalId: sid })
      .where(eq(messages.interventionId, interventionId));
  } else {
    const emailId = await sendEmail({
      to: recipientAddress,
      subject: `A quick note about your order`,
      html: buildInterventionEmailHtml({
        storeName: merchant.shopName ?? merchant.shopDomain,
        buyerFirstName,
        messageBody,
      }),
      text: messageBody,
    });
    await db.update(messages)
      .set({ externalId: emailId })
      .where(eq(messages.interventionId, interventionId));
  }

  // Update order status
  await db.update(orders)
    .set({ status: "intervening" })
    .where(eq(orders.id, orderId));
}
