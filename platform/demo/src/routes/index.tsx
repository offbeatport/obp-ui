import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { generateTaglines, type GenerateResult } from "../lib/server-fns";

export const Route = createFileRoute("/")({
  component: TaglineGeneratorPage,
});

function TaglineGeneratorPage() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateTaglines({
        data: { productName: productName.trim(), description: description.trim() },
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    void generate();
  }

  async function copyTagline(tagline: string) {
    await navigator.clipboard.writeText(tagline);
    setCopied(tagline);
    setTimeout(() => setCopied((c) => (c === tagline ? null : c)), 1500);
  }

  const canSubmit = productName.trim().length > 0 && description.trim().length > 0 && !loading;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-display font-medium tracking-tight text-fg text-sm">TaglineAI</span>
        </div>
        {result && (
          <div className="text-[11px] text-fg-muted">
            {result.remaining} generation{result.remaining !== 1 ? "s" : ""} left today
            {result.tier === "anon" && (
              <span className="ml-1 text-fg-subtle">· sign in for more</span>
            )}
          </div>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-4">
            <Sparkles size={10} />
            AI-powered · Free · Instant
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-fg mb-3 font-display">
            Tagline Generator
          </h1>
          <p className="text-base text-fg-subtle max-w-sm mx-auto">
            Describe your product, get 5 compelling taglines in seconds.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleGenerate} className="space-y-4 mb-8">
          <div>
            <label className="text-xs font-medium text-fg-muted block mb-1.5">
              Product name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Notion, Linear, Superhuman"
              maxLength={80}
              className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-muted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-fg-muted block mb-1.5">
              What does it do? Who is it for?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Project management for software teams who want to move fast without the chaos"
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-muted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-danger/10 border border-danger/25 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate taglines
              </>
            )}
          </button>
        </form>

        {/* Results */}
        {result && result.taglines.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-3">
              Your taglines
            </div>
            {result.taglines.map((tagline) => (
              <div
                key={tagline}
                className="group flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3.5 bg-bg-elevated hover:border-primary/30 transition-colors"
              >
                <span className="text-sm font-medium text-fg leading-tight">{tagline}</span>
                <button
                  type="button"
                  onClick={() => copyTagline(tagline)}
                  className="shrink-0 p-1.5 rounded text-fg-muted hover:text-fg hover:bg-fg-muted/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Copy to clipboard"
                >
                  {copied === tagline ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="w-full mt-2 text-xs text-fg-muted hover:text-fg py-2 transition-colors disabled:opacity-50"
            >
              Generate again →
            </button>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-16 text-center text-[11px] text-fg-muted">
          {result?.tier === "anon" ? (
            <>
              {result.remaining} free generation{result.remaining !== 1 ? "s" : ""} left today ·{" "}
              <span className="text-primary cursor-pointer hover:underline">Sign in for more</span>
            </>
          ) : (
            <>3 free generations per day · no signup required</>
          )}
        </div>
      </main>
    </div>
  );
}
