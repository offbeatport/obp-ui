import type { CSSProperties } from "react";
import { type Branding, paletteFor } from "~/config/spin";

// The company's generated logo: its brand `mark` letter on the AI-chosen two-color gradient.
// Used EVERYWHERE a company avatar appears (sidebar, chat header, cards, console, inbox, home).
// Falls back deterministically to first-letter + paletteFor(name) when a company has no persisted
// branding yet (drafts, the demo, pre-migration rows), so it always renders a stable gradient.
export function CompanyLogo({
    name,
    branding,
    size = 32,
    radius,
    className,
    style,
}: {
    name: string;
    branding?: Branding | null;
    size?: number;
    radius?: number; // px corner radius; defaults to ~26% of size (matches the spec letterhead)
    className?: string;
    style?: CSSProperties;
}) {
    const mark = branding?.mark ?? (name.trim()[0] ?? "C").toUpperCase();
    const palette = branding?.palette ?? paletteFor(name || "company");
    return (
        <span
            className={className}
            aria-hidden="true"
            style={{
                display: "grid",
                placeItems: "center",
                width: size,
                height: size,
                borderRadius: radius ?? Math.round(size * 0.26),
                background: `linear-gradient(145deg, ${palette[0]}, ${palette[1]})`,
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: Math.round(size * 0.42),
                lineHeight: 1,
                flex: "none",
                ...style,
            }}
        >
            {mark}
        </span>
    );
}
