import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg)", marginBottom: 16 }}>
        Hello World
      </h1>
      <p style={{ fontSize: "1rem", color: "var(--fg-muted)", lineHeight: 1.7, marginBottom: 32 }}>
        Your product goes here. Auth, payments, analytics, and error tracking are already wired up.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Link to="/dashboard" style={{ padding: "9px 20px", background: "var(--accent)", color: "#000", borderRadius: "var(--radius)", fontWeight: 600, textDecoration: "none", fontSize: "0.90rem" }}>
          Dashboard →
        </Link>
        <Link to="/login" style={{ padding: "9px 20px", border: "1px solid var(--border-strong)", color: "var(--fg-muted)", borderRadius: "var(--radius)", textDecoration: "none", fontSize: "0.90rem" }}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
