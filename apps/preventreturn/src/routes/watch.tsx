import { createFileRoute, Link } from "@tanstack/react-router";
import { ORDERS } from "../lib/data";

export const Route = createFileRoute("/watch")({
  component: WatchMode,
});

const SILENT_PREDICTIONS = ORDERS.filter((o) => o.riskScore >= 60).map((o) => ({
  id: o.id,
  product: o.product.name,
  riskScore: o.riskScore,
  signals: o.riskSignals.slice(0, 2).map((s) => s.label),
  preview: o.intervention?.messages[0]?.text ?? "",
  value: o.value,
}));

function WatchMode() {
  const daysLeft = 4;
  const daysTotal = 14;
  const daysGone = daysTotal - daysLeft;
  const progress = daysGone / daysTotal;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Watch Mode - Silent Observation
        </div>
        <h1 className="text-2xl font-semibold text-fg mb-2">
          Your agent is watching. Not yet acting.
        </h1>
        <p className="text-fg-muted leading-relaxed">
          For 14 days the agent silently scores every order and builds your return prediction model -
          without sending a single message. At the end you'll see exactly how accurate it was,
          and decide whether to turn it on.
        </p>
      </div>

      {/* Countdown */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-fg-muted mb-1">Observation period</p>
            <p className="text-3xl font-bold text-fg tabular-nums">{daysLeft} days left</p>
          </div>
          <p className="text-xs text-fg-muted">{daysGone} of {daysTotal} days complete</p>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-xs text-fg-muted mt-2">
          Agent goes live automatically on day 15 - or you can activate early below.
        </p>
      </div>

      {/* Stats so far */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Orders scored", value: "284" },
          { label: "High-risk flagged", value: "31" },
          { label: "Would have intervened", value: "31" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-fg tabular-nums">{m.value}</p>
            <p className="text-xs text-fg-muted mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Silent predictions */}
      <div>
        <p className="text-sm font-semibold text-fg mb-1">
          What the agent would have sent
        </p>
        <p className="text-xs text-fg-muted mb-4">
          These messages were generated but never sent. After 14 days you'll see which of these
          orders actually returned - proving accuracy before you commit.
        </p>

        <div className="space-y-3">
          {SILENT_PREDICTIONS.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-surface p-4 opacity-80 relative"
            >
              <div className="absolute top-3 right-3">
                <span className="text-[10px] text-fg-muted border border-border rounded px-1.5 py-0.5">
                  NOT SENT
                </span>
              </div>
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg">{p.product}</p>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Order #{p.id} · ${p.value} ·{" "}
                    <span className={p.riskScore >= 85 ? "text-danger" : "text-warning"}>
                      Risk {p.riskScore}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.signals.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] text-fg-muted bg-border/50 rounded px-1.5 py-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
              {p.preview && (
                <div className="rounded-lg bg-bg border border-border/50 p-3 text-xs text-fg-muted leading-relaxed blur-[1.5px] select-none">
                  {p.preview}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-fg-muted mt-3 text-center">
          Message previews are blurred during watch mode - they unlock on day 15.
        </p>
      </div>

      {/* CTA */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">Ready to go live early?</p>
          <p className="text-xs text-fg-muted mt-0.5">
            Your model is already accurate enough. Activate now and start preventing returns today.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm font-medium text-primary-fg bg-primary rounded px-4 py-2 hover:brightness-110 transition whitespace-nowrap ml-4"
        >
          Activate agent →
        </Link>
      </div>
    </div>
  );
}
