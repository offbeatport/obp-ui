import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllChannels } from "~/lib/project-fns";
import { CHANNEL_LABELS } from "~/lib/channels";
import { ChannelIcon } from "~/lib/channel-icons";
import type { ChannelType } from "~/lib/project-fns";

export const Route = createFileRoute("/channels")({
  loader: async () => getAllChannels(),
  component: ChannelsPage,
});

function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function DeepScanBadge({ status }: { status: string | null | undefined }) {
  if (!status || status === "idle") return <span style={{ color: "var(--fg-subtle)", fontSize: "0.72rem" }}>idle</span>;
  const map: Record<string, { color: string; label: string }> = {
    running: { color: "#60a5fa", label: "running" },
    done: { color: "#22c55e", label: "done" },
    failed: { color: "#ef4444", label: "failed" },
  };
  const s = map[status] ?? { color: "var(--fg-subtle)", label: status };
  return (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
      color: s.color, background: `${s.color}18`,
      animation: status === "running" ? "bd-pulse 1.4s ease-in-out infinite" : undefined,
    }}>
      {s.label}
    </span>
  );
}

type ChannelRow = {
  id: number;
  type: string;
  mode: string;
  config: { keywords?: string[]; subreddits?: string[] } | null;
  status: string;
  deepScanStatus: string | null;
  lastDeepScanAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
  projectId: number;
  projectName: string | null;
};

function ChannelsPage() {
  const channels = Route.useLoaderData() as ChannelRow[];

  // Group by type
  const grouped: Record<string, ChannelRow[]> = {};
  for (const ch of channels) {
    if (!grouped[ch.type]) grouped[ch.type] = [];
    grouped[ch.type].push(ch);
  }
  const types = Object.keys(grouped).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Channels</h1>
          <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--fg-subtle)", marginTop: 2 }}>
            All discovery channels across all projects - {channels.length} total
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {channels.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: 260, gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)" }}>
              No channels yet. Create a project and add channels to see them here.
            </p>
            <Link to="/i/new" search={{ opportunityId: undefined }}>
              <span style={{ fontSize: "0.80rem", color: "var(--accent)", textDecoration: "underline" }}>
                New project
              </span>
            </Link>
          </div>
        ) : (
          types.map(type => (
            <div key={type} style={{ marginBottom: 28 }}>
              {/* Type header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ChannelIcon type={type as ChannelType} size={13} style={{ color: "var(--fg-subtle)" }} />
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--fg-subtle)",
                }}>
                  {CHANNEL_LABELS[type as ChannelType] ?? type}
                </span>
                <span style={{
                  fontSize: "0.64rem", color: "var(--fg-subtle)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "1px 6px",
                }}>
                  {grouped[type].length}
                </span>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["Project", "Config", "Deep scan", "Last scan", "Last run", "Status"].map(h => (
                        <th key={h} style={{
                          padding: "7px 12px", textAlign: "left", fontSize: "0.61rem",
                          fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
                          color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[type].map(ch => {
                      const subs = ch.config?.subreddits ?? [];
                      const kws = ch.config?.keywords ?? [];
                      return (
                        <tr key={ch.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px" }}>
                            {ch.projectName ? (
                              <Link
                                to="/i/$id/channels"
                                params={{ id: String(ch.projectId) }}
                                style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--fg)", textDecoration: "none" }}
                              >
                                {ch.projectName}
                              </Link>
                            ) : (
                              <span style={{ fontSize: "0.80rem", color: "var(--fg-subtle)", fontStyle: "italic" }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.76rem", color: "var(--fg-subtle)", maxWidth: 200 }}>
                            {subs.length > 0 && (
                              <div style={{ marginBottom: kws.length > 0 ? 2 : 0 }}>
                                {subs.slice(0, 3).map(s => `r/${s}`).join(", ")}
                                {subs.length > 3 ? ` +${subs.length - 3}` : ""}
                              </div>
                            )}
                            {kws.length > 0 && (
                              <div style={{ color: "rgba(165,182,214,0.5)", fontSize: "0.70rem" }}>
                                {kws.slice(0, 3).join(", ")}
                                {kws.length > 3 ? ` +${kws.length - 3}` : ""}
                              </div>
                            )}
                            {subs.length === 0 && kws.length === 0 && "-"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <DeepScanBadge status={ch.deepScanStatus} />
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.76rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
                            {formatDate(ch.lastDeepScanAt)}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.76rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
                            {formatDate(ch.lastRunAt)}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{
                              fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.07em",
                              textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                              color: ch.status === "active" ? "#22c55e" : "var(--fg-subtle)",
                              background: ch.status === "active" ? "rgba(34,197,94,0.10)" : "rgba(165,182,214,0.08)",
                            }}>
                              {ch.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes bd-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }`}</style>
    </div>
  );
}
