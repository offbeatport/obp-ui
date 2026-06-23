import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getProjects, getGlobalStats } from "~/lib/project-fns";
import type { ProjectWithCounts, GlobalStats } from "~/lib/project-fns";
import { getGlobalQueue } from "~/lib/distribution-fns";
import { getTopOpportunities } from "~/lib/server-fns";
import type { TopOpportunityRow } from "~/lib/server-fns";
import { Button } from "~/components/ui/Button";
import { Plus, ArrowRight } from "lucide-react";

// ── Route ─────────────────────────────────────────────────────────────────────

function OverviewPending() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "52px 40px" }}>
      <div style={{ display: "flex", gap: 56, marginBottom: 52 }}>
        {[80, 60, 72, 64].map((w, i) => <div key={i} className="sk" style={{ width: w, height: 40, borderRadius: 4 }} />)}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="sk" style={{ height: 28, marginBottom: 8, opacity: 1 - i * 0.1, borderRadius: 4 }} />
      ))}
    </div>
  );
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const [projects, globalStats, queue, topOpportunities] = await Promise.all([
      getProjects(),
      getGlobalStats(),
      getGlobalQueue(),
      getTopOpportunities(),
    ]);
    return { projects, globalStats, queue, topOpportunities };
  },
  staleTime: 30_000,
  pendingComponent: OverviewPending,
  component: OverviewPage,
});

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  const n = cents / 100;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtUsers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtMrr(cents: number | null): string | null {
  if (!cents) return null;
  const n = cents / 100;
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function relativeDate(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Stat strip ────────────────────────────────────────────────────────────────

function StatStrip({ stats, monthlySpendCents = 0 }: { stats: GlobalStats; monthlySpendCents?: number }) {
  const mrr = stats.totalTargetMrrCents;
  const profit = mrr - monthlySpendCents;

  const items = [
    {
      label: "MRR",
      value: mrr > 0 ? fmtCents(mrr) + "/mo" : "-",
      color: mrr > 0 ? "var(--fg)" : "rgba(165,182,214,0.18)",
    },
    {
      label: "Users",
      value: stats.totalEmailSignups > 0 ? fmtUsers(stats.totalEmailSignups) : "-",
      color: stats.totalEmailSignups > 0 ? "var(--fg)" : "rgba(165,182,214,0.18)",
    },
    {
      label: "Spend",
      value: monthlySpendCents > 0 ? fmtCents(monthlySpendCents) + "/mo" : "-",
      color: monthlySpendCents > 0 ? "#ef4444" : "rgba(165,182,214,0.18)",
    },
    {
      label: "Profit",
      value: mrr > 0 && monthlySpendCents > 0 ? fmtCents(profit) + "/mo" : "-",
      color: profit > 0 ? "#22c55e" : profit < 0 ? "#ef4444" : "rgba(165,182,214,0.18)",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 52, marginBottom: 44 }}>
      {items.map((item, i) => (
        <div key={item.label}>
          <div style={{
            fontSize: "2.2rem",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: item.color,
            fontVariantNumeric: "tabular-nums",
            marginBottom: 6,
          }}>
            {item.value}
          </div>
          <div style={{
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(165,182,214,0.3)",
          }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Today strip ───────────────────────────────────────────────────────────────

function TodayStrip({ toReview, toPost, toGenerate }: {
  toReview: number; toPost: number; toGenerate: number;
}) {
  const total = toReview + toPost + toGenerate;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        fontSize: "0.58rem",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(165,182,214,0.3)",
        marginBottom: 12,
      }}>
        Today
      </div>

      {total === 0 ? (
        <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(165,182,214,0.35)" }}>
          ✦ All clear - nothing pending.{" "}
          <Link to="/inbox" style={{ color: "rgba(165,182,214,0.35)", textDecoration: "underline", textDecorationStyle: "dashed", textDecorationColor: "rgba(165,182,214,0.2)" }}>
            Open inbox
          </Link>
        </p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {toPost > 0 && (
            <span style={{ fontSize: "0.86rem", color: "#a78bfa", fontWeight: 600 }}>
              {toPost} to post
            </span>
          )}
          {toPost > 0 && (toReview > 0 || toGenerate > 0) && (
            <span style={{ color: "rgba(165,182,214,0.2)", fontSize: "0.84rem" }}>·</span>
          )}
          {toReview > 0 && (
            <span style={{ fontSize: "0.86rem", color: "#22c55e", fontWeight: 600 }}>
              {toReview} to review
            </span>
          )}
          {toReview > 0 && toGenerate > 0 && (
            <span style={{ color: "rgba(165,182,214,0.2)", fontSize: "0.84rem" }}>·</span>
          )}
          {toGenerate > 0 && (
            <span style={{ fontSize: "0.86rem", color: "#f59e0b", fontWeight: 600 }}>
              {toGenerate} to generate
            </span>
          )}
          <Link to="/inbox" style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            marginLeft: 8,
            fontSize: "0.80rem", color: "rgba(165,182,214,0.4)",
            textDecoration: "none",
          }}
          >
            Go to inbox <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, count, to }: { label: string; count?: number; to?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(165,182,214,0.3)" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(165,182,214,0.2)" }}>{count}</span>
      )}
      {to && (
        <Link to={to} style={{ marginLeft: "auto", fontSize: "0.70rem", color: "rgba(165,182,214,0.3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
        >
          View all <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ── Projects list ─────────────────────────────────────────────────────────────

function ProjectRow({ p }: { p: ProjectWithCounts }) {
  const isLive = p.isLive;
  const mrr = null;
  return (
    <Link key={p.id} to="/i/$id" params={{ id: String(p.id) }} style={{ textDecoration: "none", display: "block" }}>
      <div
        className="project-row"
        style={{
          display: "grid",
          gridTemplateColumns: "12px 1fr 72px 52px 52px 52px",
          alignItems: "center",
          gap: 16,
          padding: "9px 0",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          transition: "opacity 0.1s",
        }}>

        {/* Status dot */}
        <span style={{
          width: 6, height: 6, borderRadius: isLive ? "50%" : 2, display: "inline-block",
          background: isLive ? "var(--success)" : p.status === "active" ? "var(--accent)" : p.status === "paused" ? "rgba(251,191,36,0.6)" : "rgba(100,130,180,0.25)",
        }} />

        {/* Name */}
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "0.86rem", fontWeight: 500, color: "var(--fg)" }}>{p.name}</span>
          {p.description && (
            <span style={{ fontSize: "0.74rem", color: "rgba(165,182,214,0.35)", marginLeft: 10 }}>
              {p.description.length > 48 ? p.description.slice(0, 46) + "…" : p.description}
            </span>
          )}
        </div>

        {/* MRR */}
        <span style={{ fontSize: "0.82rem", fontWeight: mrr ? 600 : 400, color: mrr ? "var(--accent)" : "rgba(165,182,214,0.15)", textAlign: "right" }}>
          {mrr ?? "-"}
        </span>

        {/* Opp */}
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.80rem", fontVariantNumeric: "tabular-nums", color: p.opportunityCount > 0 ? "var(--fg-muted)" : "rgba(165,182,214,0.15)" }}>
            {p.opportunityCount}
          </span>
          <span style={{ fontSize: "0.58rem", letterSpacing: "0.06em", color: "rgba(165,182,214,0.2)", marginLeft: 3 }}>opp</span>
        </div>

        {/* Sig */}
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.80rem", fontVariantNumeric: "tabular-nums", color: p.signalCount > 0 ? "rgba(96,165,250,0.65)" : "rgba(165,182,214,0.15)" }}>
            {p.signalCount}
          </span>
          <span style={{ fontSize: "0.58rem", letterSpacing: "0.06em", color: "rgba(165,182,214,0.2)", marginLeft: 3 }}>sig</span>
        </div>

        {/* Age */}
        <span style={{ fontSize: "0.72rem", color: "rgba(165,182,214,0.22)", textAlign: "right" }}>
          {relativeDate(p.createdAt)}
        </span>
      </div>
    </Link>
  );
}

function ProjectsList({ projects }: { projects: ProjectWithCounts[] }) {
  const live = projects.filter(p => p.isLive);
  const building = projects.filter(p => !p.isLive);

  const GROUP_LABEL: React.CSSProperties = {
    fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em",
    textTransform: "uppercase", color: "rgba(165,182,214,0.25)",
    padding: "10px 0 4px",
  };

  return (
    <div style={{ marginBottom: 44 }}>
      <SectionLabel label="Projects" count={projects.length} to="/projects" />
      {live.length > 0 && (
        <div>
          <div style={GROUP_LABEL}>Live</div>
          {live.map(p => <ProjectRow key={p.id} p={p} />)}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />
        </div>
      )}
      {building.length > 0 && (
        <div>
          <div style={GROUP_LABEL}>Building</div>
          {building.map(p => <ProjectRow key={p.id} p={p} />)}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />
        </div>
      )}
      {projects.length === 0 && (
        <p style={{ margin: "12px 0 0", fontSize: "0.84rem", color: "rgba(165,182,214,0.2)" }}>No projects yet.</p>
      )}
    </div>
  );
}

// ── Opportunities list ────────────────────────────────────────────────────────

function OpportunitiesList({ opportunities }: { opportunities: TopOpportunityRow[] }) {
  const top = opportunities.slice(0, 7);

  return (
    <div style={{ marginBottom: 44 }}>
      <SectionLabel label="Top opportunities" count={opportunities.length} to="/discovery" />
      <div>
        {top.length === 0 && (
          <p style={{ margin: "12px 0 0", fontSize: "0.84rem", color: "rgba(165,182,214,0.2)" }}>
            No opportunities scored yet -{" "}
            <Link to="/discovery" style={{ color: "rgba(165,182,214,0.35)", textDecoration: "underline", textDecorationStyle: "dashed", textDecorationColor: "rgba(165,182,214,0.2)" }}>
              run Discovery
            </Link>
          </p>
        )}
        {top.map(opp => {
          const scoreColor = opp.scoreTotal >= 7.5 ? "#22c55e" : opp.scoreTotal >= 5.5 ? "#f59e0b" : "#ef4444";
          return (
            <Link key={opp.id} to="/opportunity/$id" params={{ id: String(opp.id) }} style={{ textDecoration: "none", display: "block" }}>
              <div
                className="opp-row-home"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 44px 44px",
                  alignItems: "center",
                  gap: 20,
                  padding: "9px 4px",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  margin: "0 -4px",
                  transition: "background 0.1s",
                }}>

                {/* Title */}
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: "0.86rem", fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {opp.title}
                  </span>
                </div>

                {/* Project */}
                <span style={{ fontSize: "0.72rem", color: "rgba(165,182,214,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opp.projectName ?? "-"}
                </span>

                {/* Score */}
                <span style={{ fontSize: "0.80rem", fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                  {opp.scoreTotal.toFixed(1)}
                </span>

                {/* WTP */}
                <span style={{ fontSize: "0.80rem", fontWeight: opp.wtpCount > 0 ? 600 : 400, color: opp.wtpCount > 0 ? "#22c55e" : "rgba(165,182,214,0.15)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {opp.wtpCount > 0 ? `$${opp.wtpCount}` : "-"}
                </span>
              </div>
            </Link>
          );
        })}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function OverviewPage() {
  const { projects, globalStats, queue, topOpportunities } = Route.useLoaderData() as {
    projects: ProjectWithCounts[];
    globalStats: GlobalStats;
    queue: { toReview: any[]; toPost: any[]; toGenerate: any[] };
    topOpportunities: TopOpportunityRow[];
  };
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "52px 40px 80px" }}>

        {/* Date + heading */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ margin: "0 0 10px", fontSize: "0.70rem", color: "rgba(165,182,214,0.28)", letterSpacing: "0.08em" }}>
            {today}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg)" }}>
              Overview
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/i/new", search: { opportunityId: undefined } })}
              style={{ marginLeft: "auto", gap: 5 }}
            >
              <Plus size={11} /> New project
            </Button>
          </div>
        </div>

        {/* Numbers */}
        <StatStrip stats={globalStats} />

        {/* Today */}
        <TodayStrip
          toReview={queue.toReview.length}
          toPost={queue.toPost.length}
          toGenerate={queue.toGenerate.length}
        />

        {projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.92rem", fontWeight: 600, color: "var(--fg)" }}>No projects yet</p>
            <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "rgba(165,182,214,0.4)" }}>Create one to start tracking demand.</p>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/i/new", search: { opportunityId: undefined } })}><Plus size={12} /> New project</Button>
          </div>
        ) : (
          <>
            <ProjectsList projects={projects} />
            <OpportunitiesList opportunities={topOpportunities} />
          </>
        )}

      </div>
    </div>
  );
}
