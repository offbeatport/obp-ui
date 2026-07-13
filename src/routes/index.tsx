import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, ShieldCheck } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/")({
  component: Home,
});

const SIGNALS = [
  "Chase late freelancer invoices on autopilot",
  "Branded 'pay now' link for freelancers",
  "Collect a deposit before client work starts",
];

function Home() {
  return (
    <AppShell active="home">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 py-16">
        <div className="mb-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          {"// Thought → Company"}
        </div>
        <h1 className="text-center font-display text-6xl font-light tracking-tight">
          Start your new AI company
        </h1>
        <p className="mt-4 text-center text-lg text-muted-foreground">
          I'll find the opportunities
        </p>

        {/* composer */}
        <div className="mt-9 rounded-[1.25rem] border bg-card p-2 shadow-e1 transition focus-within:ring-3 focus-within:ring-primary/25">
          <Textarea
            placeholder="What are you passionate about?"
            className="min-h-24 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Lean &amp; safe
            </span>
            <button
              type="button"
              aria-label="Find opportunities"
              className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 active:scale-95"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
        </div>

        {/* today's signals */}
        <p className="mt-12 text-center text-lg text-muted-foreground">
          Or pick one of today's signals
        </p>
        <div className="mt-3">
          {SIGNALS.map((s, i) => (
            <button
              type="button"
              key={s}
              className="flex w-full items-center gap-4 border-t px-2 py-4 text-left transition hover:bg-primary/[0.04] first:border-t-0"
            >
              <span className="grid size-6 flex-none place-items-center font-mono text-xs text-faint">
                {i + 1}
              </span>
              <span className="text-[15px]">{s}</span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
