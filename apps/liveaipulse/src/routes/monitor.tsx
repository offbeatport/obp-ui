import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Brand Monitor - LiveAIPulse" },
      {
        name: "description",
        content:
          "Get a weekly email showing your store's AI ranking position, how it changed, and what your top competitors are doing.",
      },
    ],
  }),
  component: Monitor,
});

function Monitor() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monitor/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, domain }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 38,
    padding: "0 10px",
    background: "var(--lb-bg-1)",
    border: "1px solid var(--lb-border-strong)",
    color: "var(--lb-fg)",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--lb-fg-3)",
    marginBottom: 6,
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px 80px" }}>
      {/* Eyebrow */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--lb-azure)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
          }}
        >
          Brand Monitor
        </span>
      </div>

      {/* H1 */}
      <h1
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 32,
          fontWeight: 700,
          color: "var(--lb-fg)",
          margin: "0 0 14px",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        Know exactly where you stand in AI recommendations
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 14,
          color: "var(--lb-fg-2)",
          lineHeight: 1.65,
          margin: "0 0 40px",
          maxWidth: 520,
        }}
      >
        Get a weekly email showing your store's AI ranking position, how it
        changed, and what your top competitors are doing. Free to start.
      </p>

      {/* Card grid */}
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* Free card */}
        <div
          style={{
            flex: "1 1 340px",
            border: "1px solid var(--lb-border)",
            background: "var(--lb-bg)",
            padding: 28,
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "var(--lb-fg-3)",
                textTransform: "uppercase",
              }}
            >
              Free
            </span>
          </div>

          {/* Price */}
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--lb-fg)",
              letterSpacing: "-0.02em",
              marginBottom: 20,
            }}
          >
            $0{" "}
            <span
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "var(--lb-fg-3)",
                letterSpacing: 0,
              }}
            >
              / month
            </span>
          </div>

          {/* Feature list */}
          <ul
            style={{
              fontSize: 14,
              color: "var(--lb-fg-2)",
              listStyle: "none",
              padding: 0,
              margin: "0 0 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Weekly ranking update email",
              "Your store's score and position",
              "See if you moved up or down",
            ].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: "var(--lb-azure)",
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          {done ? (
            <div
              style={{
                fontSize: 14,
                color: "var(--lb-green)",
                fontFamily: "'JetBrains Mono', monospace",
                padding: "12px 0",
                letterSpacing: "0.02em",
              }}
            >
              You're on the list. Check your inbox.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourstore.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Store domain</label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourstore.com"
                  style={inputStyle}
                />
              </div>
              {error && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--lb-red, #ef4444)",
                    margin: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !email || !domain}
                style={{
                  height: 38,
                  background: "var(--lb-azure)",
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading || !email || !domain ? "not-allowed" : "pointer",
                  opacity: loading || !email || !domain ? 0.5 : 1,
                  fontFamily: "inherit",
                  marginTop: 2,
                }}
              >
                {loading ? "Submitting…" : "Start monitoring"}
              </button>
            </form>
          )}
        </div>

        {/* Pro card */}
        <div
          style={{
            flex: "1 1 340px",
            border: "1px solid var(--lb-azure)",
            background: "var(--lb-azure-soft, rgba(0, 87, 255, 0.04))",
            padding: 28,
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "var(--lb-azure)",
                textTransform: "uppercase",
              }}
            >
              Pro - Coming Soon
            </span>
          </div>

          {/* Price */}
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--lb-fg)",
              letterSpacing: "-0.02em",
              marginBottom: 20,
            }}
          >
            $19{" "}
            <span
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "var(--lb-fg-3)",
                letterSpacing: 0,
              }}
            >
              / month
            </span>
          </div>

          {/* Feature list */}
          <ul
            style={{
              fontSize: 14,
              color: "var(--lb-fg-2)",
              listStyle: "none",
              padding: 0,
              margin: "0 0 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Everything in Free",
              "Competitor movement alerts",
              "Full position history chart",
              "Category leaderboard PDF export",
            ].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: "var(--lb-azure)",
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA - disabled waitlist */}
          <button
            type="button"
            disabled
            style={{
              height: 38,
              width: "100%",
              background: "none",
              border: "1px solid var(--lb-border-strong)",
              color: "var(--lb-fg-3)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "not-allowed",
              fontFamily: "inherit",
              opacity: 0.6,
            }}
          >
            Join waitlist
          </button>
        </div>
      </div>

      {/* Methodology note */}
      <p
        style={{
          marginTop: 32,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "var(--lb-fg-3)",
          letterSpacing: "0.02em",
        }}
      >
        Rankings update daily. Emails sent every Monday morning.
      </p>
    </div>
  );
}
