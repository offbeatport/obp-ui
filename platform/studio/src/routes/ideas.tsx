import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { getIdeas } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import { Plus } from "lucide-react";
import type { Idea } from "~/lib/project-fns";

export const Route = createFileRoute("/ideas")({
  loader: async () => getIdeas(),
  component: IdeasLayout,
});

function statusBadge(status: Idea["status"]) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    setup: { label: "setup", color: "rgba(165,182,214,0.7)", bg: "rgba(165,182,214,0.08)" },
    communities: { label: "communities", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
    analyzing: { label: "analyzing", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
    ready: { label: "ready", color: "var(--accent)", bg: "rgba(0,255,136,0.08)" },
    killed: { label: "killed", color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
    promoted: { label: "promoted", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
  };
  const s = map[status] ?? map.setup;
  return (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
      color: s.color, background: s.bg,
      animation: status === "analyzing" ? "bd-pulse 1.4s ease-in-out infinite" : undefined,
    }}>
      {s.label}
    </span>
  );
}

function verdictBadge(verdict?: "go" | "maybe" | "kill") {
  if (!verdict) return null;
  const map = {
    go: { color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
    maybe: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
    kill: { color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  };
  const s = map[verdict];
  return (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
      color: s.color, background: s.bg,
    }}>
      {verdict}
    </span>
  );
}

function IdeasLayout() {
  const ideas = Route.useLoaderData();
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Ideas</h1>
          <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--fg-subtle)", marginTop: 2 }}>
            Hypothesis-driven analysis before committing to a project
          </p>
        </div>
        <Link to="/ideas/new">
          <Button variant="primary" size="sm" style={{ gap: 5 }}>
            <Plus size={13} />
            New Idea
          </Button>
        </Link>
      </div>

      {/* Body: list on left (or full if no nested route active) */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {ideas.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 300, gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)" }}>No ideas yet.</p>
            <Link to="/ideas/new">
              <Button variant="outline" size="sm">Create your first idea</Button>
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Status", "Communities", "Verdict", "Created"].map(h => (
                  <th key={h} style={{
                    padding: "8px 16px", textAlign: "left", fontSize: "0.64rem",
                    fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                    color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)",
                    background: "var(--bg)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ideas.map(idea => (
                <tr
                  key={idea.id}
                  onClick={() => router.navigate({ to: "/ideas/$id", params: { id: String(idea.id) } })}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                  className="hover-row"
                >
                  <td style={{ padding: "10px 16px", fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)" }}>
                    {idea.name}
                    {idea.hypothesis && (
                      <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", marginTop: 2, fontWeight: 400 }}>
                        {idea.hypothesis.slice(0, 80)}{idea.hypothesis.length > 80 ? "…" : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {statusBadge(idea.status)}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "0.80rem", color: "var(--fg-subtle)" }}>
                    {idea.selectedCommunities ? idea.selectedCommunities.length : 0}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    {idea.analysisJson ? verdictBadge(idea.analysisJson.verdict) : <span style={{ color: "var(--fg-subtle)", fontSize: "0.72rem" }}>-</span>}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "0.76rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .hover-row:hover td { background: var(--bg-elevated); }
        @keyframes bd-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
}
