// Shared style constants and components for settings sub-routes

export const LABEL: React.CSSProperties = {
  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 6,
};

export const HINT: React.CSSProperties = {
  margin: "5px 0 0", fontSize: "0.70rem", color: "var(--fg-subtle)", lineHeight: 1.55,
};

export const CARD: React.CSSProperties = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 16,
};

export function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "1.0rem", fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>{desc}</p>
    </div>
  );
}
