import type { CSSProperties } from "react";

export type GradientMarkBranding = {
    mark?: string;
    palette?: [string, string];
};

export function gradientPairFor(seed: string): [string, string] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = (h % 12) * 30;
    return [
        `oklch(from var(--primary) calc(l + 0.07) c calc(h + ${hue}))`,
        `oklch(from var(--primary) calc(l - 0.07) c calc(h + ${hue + 22}))`,
    ];
}

export function GradientMark({
    name,
    branding,
    size = 32,
    radius,
    className,
    style,
}: {
    name: string;
    branding?: GradientMarkBranding | null;
    size?: number;
    radius?: number;
    className?: string;
    style?: CSSProperties;
}) {
    const mark = branding?.mark ?? (name.trim()[0] ?? "?").toUpperCase();
    const palette = branding?.palette ?? gradientPairFor(name);
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
                backgroundColor: "var(--primary)",
                backgroundImage: `linear-gradient(145deg, ${palette[0]}, ${palette[1]})`,
                color: "var(--primary-foreground)",
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
