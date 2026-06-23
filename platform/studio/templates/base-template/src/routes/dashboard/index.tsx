import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { LogOut, User, CreditCard, Settings } from "lucide-react";
import { signOut, useSession } from "../../lib/auth-client.js";

// ── Auth guard (server-side) ──────────────────────────────────────────────────

const getSessionServer = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await import("../../lib/auth.js");
  const req = getWebRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
});

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    const session = await getSessionServer();
    if (!session?.user) {
      throw redirect({ to: "/login" });
    }
    return { user: session.user };
  },
  component: DashboardPage,
});

// ── Component ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em" }}>
        {value}
      </span>
      <span style={{ fontSize: "0.8rem", color: "var(--fg-dim)" }}>
        {description}
      </span>
    </div>
  );
}

function DashboardPage() {
  const { user } = Route.useLoaderData();
  const { data: session } = useSession();
  const displayUser = session?.user ?? user;

  async function handleSignOut() {
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 40,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
              marginBottom: 4,
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)", margin: 0 }}>
            Welcome back, {displayUser?.name || displayUser?.email}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSignOut}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--fg-muted)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        <StatCard label="Plan" value="Free" description="Upgrade for more features" />
        <StatCard label="Usage" value="0 / 3" description="Projects this month" />
        <StatCard label="Member since" value={new Date().getFullYear().toString()} description="Account in good standing" />
      </div>

      {/* Quick actions */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)", margin: 0 }}>
            Quick actions
          </h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { icon: User, label: "Account settings", href: "/settings" },
            { icon: CreditCard, label: "Manage subscription", href: "/pricing" },
            { icon: Settings, label: "App settings", href: "/settings" },
          ].map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              to={href as "/"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                color: "var(--fg-muted)",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.02)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)";
              }}
            >
              <Icon size={15} style={{ color: "var(--fg-dim)", flexShrink: 0 }} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
