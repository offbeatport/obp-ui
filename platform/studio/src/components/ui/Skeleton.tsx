import type { CSSProperties } from "react";

export function Sk({ w = "100%", h = 14, radius = 3, style }: {
  w?: number | string;
  h?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="sk"
      style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

// Full-page loading skeleton matching the standard app layout
export function PageSkeleton({ header = true }: { header?: boolean }) {
  return (
    <div style={{ padding: "32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
      {header && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Sk w={120} h={11} />
          <Sk w="60%" h={28} />
          <Sk w="80%" h={14} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Sk w={70} h={22} />
            <Sk w={90} h={22} />
            <Sk w={60} h={22} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Sk key={i} h={36} style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  );
}
