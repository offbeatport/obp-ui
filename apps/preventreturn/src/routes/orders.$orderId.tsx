import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getSession } from "../lib/session";
import { createServerFn } from "@tanstack/react-start";

type OrderDetail = {
  id: string;
  shopifyOrderNumber: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  productName: string | null;
  productSku: string | null;
  productCategory: string | null;
  orderValue: number;
  riskScore: number;
  riskSignals: Array<{ label: string; severity: "high" | "medium" | "low"; weight: number }>;
  status: string;
  placedAt: Date | null;
  intervention: {
    id: string;
    channel: string;
    outcome: string;
    recipientAddress: string;
    sentAt: Date;
    messages: Array<{ id: string; from: string; body: string; sentAt: Date }>;
  } | null;
};

const loadOrder = createServerFn({ method: "POST" })
  .handler(async (ctx: any) => {
    const orderId: string = ctx?.data?.orderId ?? ctx?.orderId ?? "";
    const data = { orderId };
    try {
      const { auth } = await import("../lib/auth");
      const { db } = await import("../db/client");
      const { orders, interventions, messages, merchants } = await import("../db/schema");
      const { eq, and } = await import("drizzle-orm");

      const request: Request = ctx?.request ?? new Request("http://localhost");
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) return null;

      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.userId, session.user.id),
      });
      if (!merchant) return null;

      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, data.orderId), eq(orders.merchantId, merchant.id)),
      });
      if (!order) return null;

      const intervention = await db.query.interventions.findFirst({
        where: eq(interventions.orderId, order.id),
      });

      const msgs = intervention
        ? await db.select().from(messages).where(eq(messages.interventionId, intervention.id))
        : [];

      return {
        id: order.id,
        shopifyOrderNumber: order.shopifyOrderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        productName: order.productName,
        productSku: order.productSku,
        productCategory: order.productCategory,
        orderValue: order.orderValue,
        riskScore: order.riskScore,
        riskSignals: (order.riskSignals ?? []) as OrderDetail["riskSignals"],
        status: order.status,
        placedAt: order.placedAt,
        intervention: intervention
          ? {
            id: intervention.id,
            channel: intervention.channel,
            outcome: intervention.outcome,
            recipientAddress: intervention.recipientAddress,
            sentAt: intervention.sentAt,
            messages: msgs.map((m) => ({
              id: m.id,
              from: m.from,
              body: m.body,
              sentAt: m.sentAt,
            })),
          }
          : null,
      } satisfies OrderDetail;
    } catch (err) {
      console.error("[loadOrder error]", err);
      return null;
    }
  });

export const Route = createFileRoute("/orders/$orderId")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => {
    const order = await (loadOrder as any)({ orderId: params.orderId });
    if (!order) throw notFound();
    return order;
  },
  component: OrderDetail,
});

function SignalRow({ label, severity }: { label: string; severity: "high" | "medium" | "low" }) {
  const colors = { high: "text-danger", medium: "text-warning", low: "text-fg-muted" };
  const icons = { high: "●", medium: "●", low: "○" };
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <span className={`text-[10px] mt-0.5 ${colors[severity]}`}>{icons[severity]}</span>
      <span className="text-sm text-fg">{label}</span>
      <span className={`ml-auto text-xs font-medium capitalize ${colors[severity]}`}>{severity}</span>
    </div>
  );
}

function ScoreArc({ score }: { score: number }) {
  const r = 40; const cx = 60; const cy = 60;
  const circumference = Math.PI * r;
  const fraction = score / 100;
  const color = score >= 85 ? "rgb(var(--danger))" : score >= 60 ? "rgb(var(--warning))" : "rgb(var(--success))";
  return (
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgb(var(--border))" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${circumference * fraction} ${circumference}`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="600" fill={color}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="rgb(var(--fg-muted))">RISK SCORE</text>
    </svg>
  );
}

type MsgType = { id: string; from: string; body: string; sentAt: Date };
function MessageBubble({ msg }: { msg: MsgType }) {
  const isAgent = msg.from === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[80%]">
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isAgent ? "bg-surface border border-border text-fg rounded-tl-sm" : "bg-primary text-primary-fg rounded-tr-sm"}`}>
          {msg.body}
        </div>
        <p className={`text-[10px] text-fg-muted mt-1 ${isAgent ? "text-left" : "text-right"}`}>
          {isAgent ? "PreventReturn Agent" : "Buyer"} · {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function GeneratePanel({ order }: { order: OrderDetail }) {
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: order.productName ?? "your order",
          signals: (order.riskSignals as Array<{ label: string }>).map((s) => s.label),
          channel: order.intervention?.channel ?? "sms",
          buyerName: order.buyerName?.split(" ")[0] ?? "there",
        }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (data.message) setGenerated(data.message);
      else toast.error(data.error ?? "Generation failed");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-fg">Live AI Generation</p>
          <p className="text-xs text-fg-muted">Generate a real intervention message for this order</p>
        </div>
        <button type="button" onClick={generate} disabled={loading}
          className="text-sm font-medium text-primary-fg bg-primary rounded px-3 py-1.5 hover:brightness-110 disabled:opacity-50 transition">
          {loading ? "Generating…" : "Generate message"}
        </button>
      </div>
      {generated && (
        <div className="mt-3 rounded-lg bg-surface border border-border p-3 text-sm text-fg leading-relaxed">
          {generated}
        </div>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "size_swapped") return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">✓ Size swapped - return prevented</span>;
  if (outcome === "kept") return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">✓ Confirmed - return prevented</span>;
  if (outcome === "cancelled") return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted bg-surface border border-border px-3 py-1.5 rounded-full">✗ Cancelled - return cost avoided</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Awaiting buyer reply…</span>;
}

function OrderDetail() {
  const order = Route.useLoaderData();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/app" className="text-sm text-fg-muted hover:text-fg transition-colors">Dashboard</Link>
        <span className="text-fg-muted">/</span>
        <span className="text-sm text-fg">Order #{order.shopifyOrderNumber ?? order.id.slice(0, 8)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-lg bg-border flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-fg">{order.productName ?? "Order"}</p>
                <p className="text-xs text-fg-muted">{order.productSku ?? "-"} · {order.productCategory ?? "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-fg-muted">Buyer</p><p className="text-fg font-medium">{order.buyerName ?? "-"}</p></div>
              <div><p className="text-fg-muted">Order value</p><p className="text-fg font-medium">${order.orderValue.toFixed(0)}</p></div>
              <div><p className="text-fg-muted">Placed</p><p className="text-fg font-medium">{order.placedAt ? new Date(order.placedAt).toLocaleDateString() : "-"}</p></div>
              <div><p className="text-fg-muted">Channel</p><p className="text-fg font-medium capitalize">{order.intervention?.channel ?? "-"}</p></div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-fg-muted font-medium uppercase tracking-wide mb-3">Risk Assessment</p>
            <div className="flex justify-center mb-2"><ScoreArc score={order.riskScore} /></div>
            <div>
              {order.riskSignals.map((signal: { label: string; severity: "high" | "medium" | "low" }) => (
                <SignalRow key={signal.label} label={signal.label} severity={signal.severity} />
              ))}
              {order.riskSignals.length === 0 && (
                <p className="text-xs text-fg-muted text-center py-3">No risk signals recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="md:col-span-3 space-y-4">
          {order.intervention && (
            <div className="flex items-center justify-between">
              <OutcomeBadge outcome={order.intervention.outcome} />
              <span className="text-xs text-fg-muted">{order.intervention.channel.toUpperCase()}</span>
            </div>
          )}

          {order.intervention && order.intervention.messages.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-fg">Intervention thread</p>
                <span className="text-xs text-fg-muted">
                  {order.intervention.channel === "sms" ? "📱 SMS" : "✉️ Email"}
                  {" · "}
                  {new Date(order.intervention.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="space-y-3">
                {order.intervention.messages.map((msg: MsgType) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </div>
            </div>
          )}

          <GeneratePanel order={order} />

          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <p className="text-xs text-fg-muted leading-relaxed">
              <span className="text-fg font-medium">A/B protected:</span>{" "}
              {order.intervention
                ? "This order was in the intervened group and received an automated message."
                : "This order was in the control group - no message was sent."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
