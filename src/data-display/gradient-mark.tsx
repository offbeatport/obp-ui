import type { CSSProperties } from "react";

export type GradientMarkBranding = {
    mark?: string;
    palette?: [string, string];
};

function seedHue(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return (h % 12) * 30;
}

export function markColorFor(seed: string): string {
    return `oklch(from var(--primary) l c calc(h + ${seedHue(seed)}))`;
}

export function gradientPairFor(seed: string): [string, string] {
    const hue = seedHue(seed);
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
    const fill = branding?.palette?.[0] ?? markColorFor(name);
    return (
        <span
            className={className}
            aria-hidden="true"
            style={{
                display: "grid",
                placeItems: "center",
                width: size,
                height: size,
                borderRadius: radius ?? "var(--radius)",
                backgroundColor: fill,
                color: "var(--primary-foreground)",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: Math.round(size * 0.42),
                lineHeight: 1,
                textBox: "trim-both cap alphabetic",
                flex: "none",
                ...style,
            }}
        >
            {mark}
        </span>
    );
}
