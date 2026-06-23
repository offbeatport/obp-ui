import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  domain: z.string().optional(),
});

export const Route = createFileRoute("/monitor/success")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Monitoring active - LiveAIPulse" }],
  }),
  component: MonitorSuccess,
});

function MonitorSuccess() {
  const { domain } = useSearch({ from: "/monitor/success" });

  return (
    <div
      style={{
        minHeight: "calc(100vh - 52px - 80px)",
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          border: "1px solid var(--lb-border)",
          background: "var(--lb-bg)",
          padding: 40,
          textAlign: "center",
        }}
      >
        {/* Status indicator */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--lb-green)",
            marginBottom: 20,
            fontWeight: 600,
          }}
        >
          ● Active
        </div>

        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--lb-fg)",
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
            lineHeight: 1.2,
          }}
        >
          {domain
            ? `You're now monitoring ${domain}`
            : "You're now monitoring your store"}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--lb-fg-2)",
            lineHeight: 1.65,
            margin: "0 0 32px",
          }}
        >
          Your first weekly report will arrive next Monday morning. We'll track
          your AI ranking position and let you know how you move.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
          }}
        >
          {domain && (
            <Link
              to="/store/$domain"
              params={{ domain }}
              style={{
                display: "inline-block",
                height: 38,
                lineHeight: "38px",
                padding: "0 20px",
                background: "var(--lb-azure)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                fontFamily: "inherit",
              }}
            >
              View {domain} ranking →
            </Link>
          )}

          <Link
            to="/"
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: "var(--lb-fg-3)",
              textDecoration: "none",
              letterSpacing: "0.02em",
              paddingTop: 4,
            }}
          >
            ← Back to leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
