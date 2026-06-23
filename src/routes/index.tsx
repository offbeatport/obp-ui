import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
      <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
        C Slop Slop
      </h1>
      <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--fg-subtle)", maxWidth: 460, textAlign: "center", lineHeight: 1.6 }}>
        An agent fleet that turns hunches into autonomously-run companies.
        Clean slate — ready to build.
      </p>
    </div>
  );
}
