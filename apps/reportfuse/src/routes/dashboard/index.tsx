import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh] px-8">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 border border-dashed border-border flex items-center justify-center mx-auto mb-5 text-fg-subtle">
          <Upload size={20} strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-display font-light text-fg tracking-tight mb-2">No runs yet</h2>
        <p className="text-sm text-fg-muted mb-6 leading-relaxed">
          Drop your first CSV to get started. Your runs will appear in the sidebar once you do.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-fg bg-primary border border-primary hover:brightness-110 transition-all"
        >
          <Upload size={14} />
          Upload a CSV
        </Link>
        <div className="mt-8 pt-6 border-t border-border text-left space-y-3">
          {[
            "Supports Google Ads, Meta, TikTok, LinkedIn + any platform",
            "AI maps every column automatically",
            "Saved mappings improve with every correction",
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-2.5 text-xs text-fg-muted">
              <ArrowRight size={12} className="text-fg-subtle shrink-0 mt-0.5" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
