import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Input } from "@offbeatport/ui/ui/input";
import { getSession } from "../lib/session";
import { createServerFn } from "@tanstack/react-start";
import type { DashboardOrder } from "../lib/dashboard-data";

export type { DashboardOrder };

const getMerchantData = createServerFn().handler(async (ctx: any) => {
  try {
    const { auth } = await import("../lib/auth");
    const { db } = await import("../db/client");
    const { merchants, merchantSettings } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const { getDashboardData } = await import("../lib/dashboard-data");

    const request: Request = ctx?.request ?? new Request("http://localhost");
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.userId, session.user.id),
    });
    if (!merchant) return null;

    const settings = await db.query.merchantSettings.findFirst({
      where: eq(merchantSettings.merchantId, merchant.id),
    });

    const { orders, metrics } = await getDashboardData(merchant.id);

    return {
      merchant: {
        id: merchant.id,
        shopDomain: merchant.shopDomain,
        shopName: merchant.shopName,
        agentEnabled: merchant.agentEnabled,
      },
      settings: settings ?? null,
      orders,
      metrics,
    };
  } catch (err) {
    console.error("[getMerchantData error]", err);
    return null;
  }
});

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) throw redirect({ to: "/login" });
    return { session };
  },
  loader: async () => {
    const data = await getMerchantData();
    return { merchantData: data };
  },
  component: Dashboard,
});

// --- Chart ---

function ReturnRateChart({ live, data }: { live: boolean; data: number[] }) {
  const w = 600; const h = 80; const pad = 8;
  const chartData = data.length >= 30 ? data : Array(30).fill(18);
  const min = Math.max(0, Math.min(...chartData) - 2);
  const max = Math.max(...chartData) + 2;
  const inflection = 15;

  const pts = (slice: number[], offset = 0) =>
    slice.map((v, i) => {
      const x = pad + ((i + offset) / (chartData.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return `${x},${y}`;
    });

  const beforePts = pts(chartData.slice(0, inflection + 1));
  const afterPts = pts(chartData.slice(inflection), inflection);
  const inflectionX = pad + (inflection / (chartData.length - 1)) * (w - pad * 2);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }}>
        <polyline points={beforePts.join(" ")} fill="none" stroke="rgb(var(--fg-muted) / 0.3)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={afterPts.join(" ")} fill="none" stroke={live ? "rgb(var(--primary))" : "rgb(var(--fg-muted) / 0.3)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={live ? undefined : "4,4"} />
        <line x1={inflectionX} y1={pad} x2={inflectionX} y2={h - pad} stroke="rgb(var(--primary) / 0.3)" strokeWidth="1" strokeDasharray="3,3" />
      </svg>
      <div className="absolute text-[9px] text-fg-muted font-medium" style={{ left: inflectionX + 4, top: 4 }}>
        {live ? "Agent on" : "Agent off"}
      </div>
    </div>
  );
}

// --- Agent toggle ---

function AgentToggle({ live, onToggle }: { live: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-all duration-200 ${live ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}
    >
      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${live ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${live ? "translate-x-4" : "translate-x-0"}`} />
      </div>
      <div className="text-left">
        <p className={`text-sm font-semibold leading-tight ${live ? "text-primary" : "text-fg-muted"}`}>
          {live ? "Agent is live" : "Agent is disabled"}
        </p>
        <p className="text-[11px] text-fg-muted leading-tight">
          {live ? "Monitoring and intervening" : "Watching only - no messages sent"}
        </p>
      </div>
      {live && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
    </button>
  );
}

// --- Badges ---

function RiskBadge({ score }: { score: number }) {
  if (score >= 85) return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-danger/15 text-danger"><span className="w-1 h-1 rounded-full bg-danger" />{score} High</span>;
  if (score >= 60) return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning"><span className="w-1 h-1 rounded-full bg-warning" />{score} Med</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success"><span className="w-1 h-1 rounded-full bg-success" />{score} Low</span>;
}

function StatusCell({ order, live }: { order: DashboardOrder; live: boolean }) {
  if (!live && order.riskScore >= 60)
    return <span className="inline-flex items-center gap-1 text-xs text-fg-muted border border-dashed border-border rounded px-1.5 py-0.5">Would send</span>;
  if (order.status === "watching") return <span className="text-xs text-fg-muted">Low risk</span>;
  if (order.status === "intervening") {
    const outcome = order.intervention?.outcome;
    if (outcome === "size_swapped") return <span className="text-xs text-success font-medium">Size swapped ✓</span>;
    if (outcome === "kept") return <span className="text-xs text-success font-medium">Kept ✓</span>;
    if (outcome === "cancelled") return <span className="text-xs text-fg-muted">Cancelled (avoided)</span>;
    return <span className="inline-flex items-center gap-1 text-xs text-primary font-medium"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />Awaiting reply</span>;
  }
  if (order.status === "resolved") {
    const outcome = order.intervention?.outcome;
    if (outcome === "size_swapped") return <span className="text-xs text-success font-medium">Size swapped ✓</span>;
    if (outcome === "kept") return <span className="text-xs text-success font-medium">Kept ✓</span>;
    if (outcome === "cancelled") return <span className="text-xs text-fg-muted">Cancelled (avoided)</span>;
  }
  return <span className="text-xs text-fg-muted">Skipped</span>;
}

// --- Metric card ---

function MetricCard({ label, value, sub, highlight, dim }: {
  label: string; value: string; sub?: string; highlight?: boolean; dim?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 transition-opacity ${dim ? "opacity-40" : ""} ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}>
      <p className="text-xs text-fg-muted mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${highlight ? "text-primary" : "text-fg"}`}>{value}</p>
      {sub && <p className="text-xs text-fg-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// --- Inline SMS thread ---

function InlineThread({ order }: { order: DashboardOrder }) {
  if (!order.intervention) return null;
  return (
    <tr className="bg-bg border-b border-border">
      <td colSpan={7} className="px-6 py-4">
        <div className="max-w-xl space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-fg-muted font-medium uppercase tracking-wide">
              {order.intervention.channel === "sms" ? "📱 SMS thread" : "✉️ Email thread"}
            </span>
            <span className="text-xs text-fg-muted">
              · {new Date(order.intervention.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {order.intervention.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}>
              <div className="max-w-[80%]">
                <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.from === "agent" ? "bg-surface border border-border text-fg rounded-tl-sm" : "bg-primary text-primary-fg rounded-tr-sm"}`}>
                  {msg.body}
                </div>
                <p className={`text-[10px] text-fg-muted mt-1 ${msg.from === "agent" ? "text-left" : "text-right"}`}>
                  {msg.from === "agent" ? "PreventReturn" : "Buyer"} · {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Link to="/orders/$orderId" params={{ orderId: order.id }} className="text-xs text-primary hover:text-primary/80 transition-colors">
              Full detail + generate new message →
            </Link>
          </div>
        </div>
      </td>
    </tr>
  );
}

// --- Empty state ---

function EmptyState({ live }: { live: boolean }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-lg">
            {live ? "👁" : "⏸"}
          </div>
          <p className="text-sm font-medium text-fg">
            {live ? "Waiting for first order…" : "Agent is paused"}
          </p>
          <p className="text-xs text-fg-muted max-w-xs">
            {live
              ? "The agent is monitoring in real-time. New orders will appear here as they come in."
              : "Enable the agent above to start monitoring orders."}
          </p>
        </div>
      </td>
    </tr>
  );
}

// --- Main dashboard ---

function ConnectStore() {
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/shopify/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });

      const text = await res.text();
      let data: { redirectUrl?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[ConnectStore] non-JSON response:", text.slice(0, 200));
        setError("Server error. Check the console for details.");
        setLoading(false);
        return;
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setError(data.error ?? "Something went wrong. Check your store URL.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("[ConnectStore fetch error]", err);
      setError(err?.message ?? "Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 6V14L10 18L2 14V6L10 2Z" stroke="rgb(var(--primary))" strokeWidth="1.5" fill="none" />
              <circle cx="10" cy="10" r="2.5" fill="rgb(var(--primary))" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-fg mb-2">Connect your Shopify store</h1>
          <p className="text-fg-muted leading-relaxed text-sm">
            Enter your store URL to install PreventReturn. You'll be redirected to Shopify to approve access, then brought back here.
          </p>
        </div>

        <form onSubmit={handleConnect} className="flex gap-2">
          <Input
            type="text"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="yourstore.myshopify.com"
            required
            disabled={loading}
            className="flex-1"
          />
          <button
            type="submit"
            disabled={loading || !shop.trim()}
            className="text-sm font-semibold text-primary-fg bg-primary rounded-lg px-4 py-2 hover:brightness-110 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
                  <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Redirecting…
              </span>
            ) : "Connect store"}
          </button>
        </form>

        {error && (
          <p className="text-xs text-danger mt-2 text-center">{error}</p>
        )}

        <p className="text-xs text-fg-muted mt-3 text-center">
          Requires <code className="text-xs bg-surface px-1 py-0.5 rounded border border-border">read_orders</code> and <code className="text-xs bg-surface px-1 py-0.5 rounded border border-border">write_orders</code> permissions.
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { merchantData } = Route.useLoaderData();
  const [live, setLive] = useState(merchantData?.merchant.agentEnabled ?? false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newOrderId, setNewOrderId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dbOrders = merchantData?.orders ?? [];
  const metrics = merchantData?.metrics;
  const delta = metrics
    ? metrics.returnRatePrevious - metrics.returnRateCurrent
    : 0;

  // Show connect-store flow if no store is linked
  if (!merchantData) return <ConnectStore />;

  // Sync live state when loader data changes
  useEffect(() => {
    setLive(merchantData.merchant.agentEnabled);
  }, [merchantData.merchant.agentEnabled]);

  // Pulse newest order if any
  useEffect(() => {
    if (dbOrders.length > 0 && dbOrders[0]) {
      setNewOrderId(dbOrders[0].id);
      const t = setTimeout(() => setNewOrderId(null), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  async function handleToggle() {
    const next = !live;
    setLive(next);
    if (merchantData?.merchant.id) {
      await fetch("/api/agent-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, merchantId: merchantData.merchant.id }),
      });
    }
  }

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">
            {merchantData.merchant.shopName ?? merchantData.merchant.shopDomain}
          </h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {(metrics?.ordersMonitored ?? 0).toLocaleString()} orders monitored this month
          </p>
        </div>
        <AgentToggle live={live} onToggle={handleToggle} />
      </div>

      {/* Watching banner */}
      {!live && (
        <div className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-3 flex items-center gap-3">
          <span className="text-fg-muted text-lg">👁</span>
          <div>
            <p className="text-sm text-fg font-medium">Agent is watching - no messages are being sent</p>
            <p className="text-xs text-fg-muted mt-0.5">High-risk orders are flagged below. Toggle live when you're ready.</p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Return rate this month"
          value={live && metrics ? `${metrics.returnRateCurrent}%` : `${metrics?.returnRatePrevious ?? 0}%`}
          sub={live && delta > 0 ? `↓ ${delta.toFixed(1)}pp vs. last month` : "Agent off"}
          highlight={live} dim={!live}
        />
        <MetricCard
          label="Returns prevented"
          value={live ? String(metrics?.returnsPrevented ?? 0) : "0"}
          sub="via AI intervention" dim={!live}
        />
        <MetricCard
          label="Net saved"
          value={live ? `$${(metrics?.savedDollars ?? 0).toLocaleString()}` : "$0"}
          sub="logistics + margin" dim={!live}
        />
        <MetricCard
          label="Interventions sent"
          value={live ? String(metrics?.interventionsSent ?? 0) : "0"}
          sub={live && metrics?.interventionsSent ? `${metrics.successRate}% success rate` : "Enable agent to start"}
          dim={!live}
        />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-fg">Return rate - last 30 days</p>
            <p className="text-xs text-fg-muted">{live ? "Improvement since agent went live" : "Enable agent to see improvement"}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-fg-muted">
            <span className="flex items-center gap-1"><span className="w-6 h-px bg-fg-muted/30 inline-block" /> Before</span>
            <span className="flex items-center gap-1"><span className={`w-6 h-px inline-block ${live ? "bg-primary" : "bg-fg-muted/30"}`} /> {live ? "After" : "Projected"}</span>
          </div>
        </div>
        <ReturnRateChart live={live} data={metrics?.chartData ?? []} />
        <div className="flex justify-between text-[10px] text-fg-muted mt-1 px-1">
          <span>30 days ago</span><span>Today</span>
        </div>
      </div>

      {/* Order feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fg">Order Feed</h2>
          <span className={`flex items-center gap-1 text-xs ${live ? "text-primary" : "text-fg-muted"}`}>
            {live
              ? <><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live</>
              : <><span className="w-1.5 h-1.5 rounded-full bg-fg-muted" /> Watching</>}
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                {["Order", "Product", "Buyer", "Value", "Risk", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs text-fg-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dbOrders.length === 0 && <EmptyState live={live} />}
              {dbOrders.map((order) => {
                const isNew = order.id === newOrderId;
                const isExpanded = expandedId === order.id;
                const canExpand = order.intervention !== null;
                return (
                  <>
                    <tr key={order.id} onClick={() => canExpand && toggleRow(order.id)}
                      className={`border-b border-border transition-all ${canExpand ? "cursor-pointer" : ""} ${isNew ? "bg-primary/10 animate-pulse" : ""} ${isExpanded ? "bg-hover" : "hover:bg-hover"}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-fg-muted">#{order.shopifyOrderNumber ?? order.id.slice(0, 8)}</span>
                        {isNew && <span className="ml-1.5 text-[10px] text-primary font-medium">NEW</span>}
                        <p className="text-[10px] text-fg-muted/60 mt-0.5">{order.placedAt ? new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-border flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-fg leading-tight">{order.productName ?? "Order"}</p>
                            <p className="text-[10px] text-fg-muted">{order.productCategory ?? "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">{order.buyerName ?? "-"}</td>
                      <td className="px-4 py-3 text-xs text-fg font-medium tabular-nums">${order.orderValue.toFixed(0)}</td>
                      <td className="px-4 py-3"><RiskBadge score={order.riskScore} /></td>
                      <td className="px-4 py-3"><StatusCell order={order} live={live} /></td>
                      <td className="px-4 py-3 text-right">
                        {canExpand && <span className={`text-xs text-fg-muted inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>}
                      </td>
                    </tr>
                    {isExpanded && <InlineThread key={`thread-${order.id}`} order={order} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden rounded-lg border border-border overflow-hidden divide-y divide-border">
          {dbOrders.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-fg-muted">{live ? "Waiting for first order…" : "Enable agent to start"}</p>
            </div>
          )}
          {dbOrders.map((order) => {
            const isExpanded = expandedId === order.id;
            const canExpand = order.intervention !== null;
            return (
              <div key={order.id}>
                <div
                  onClick={() => canExpand && toggleRow(order.id)}
                  className={`p-4 ${canExpand ? "cursor-pointer" : ""} hover:bg-hover transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-fg-muted">#{order.shopifyOrderNumber ?? order.id.slice(0, 8)}</span>
                        <RiskBadge score={order.riskScore} />
                      </div>
                      <p className="text-sm font-medium text-fg truncate">{order.productName ?? "Order"}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{order.buyerName ?? "-"} · ${order.orderValue.toFixed(0)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <StatusCell order={order} live={live} />
                      {canExpand && <p className="text-[10px] text-fg-muted mt-1">Tap to expand</p>}
                    </div>
                  </div>
                </div>
                {isExpanded && order.intervention && (
                  <div className="px-4 pb-4 bg-bg">
                    <div className="space-y-2 pt-3 border-t border-border">
                      {order.intervention.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.from === "agent" ? "bg-surface border border-border text-fg" : "bg-primary text-primary-fg"}`}>
                            {msg.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {dbOrders.length > 0 && (
          <p className="hidden md:block text-xs text-fg-muted mt-2 text-center">
            Click any row with an intervention to expand inline
          </p>
        )}
      </div>

      {/* Net benefit */}
      {live && metrics && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-fg-muted mb-3 font-medium uppercase tracking-wide">Net benefit this month</p>
          <div className="flex items-end gap-8 flex-wrap">
            <div>
              <p className="text-xs text-fg-muted">Returns prevented</p>
              <p className="text-lg font-semibold text-success">+${metrics.savedDollars.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-fg-muted">Cancellations caused</p>
              <p className="text-lg font-semibold text-fg-muted">−$0</p>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <div>
              <p className="text-xs text-fg-muted">Net gain</p>
              <p className="text-2xl font-bold text-primary">${metrics.savedDollars.toLocaleString()}</p>
            </div>
            <p className="text-xs text-fg-muted md:ml-auto self-center">
              You pay $0 in months where net gain ≤ $0
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
