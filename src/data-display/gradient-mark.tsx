import type { CSSProperties } from "react";

// The entity avatar: one letter on a two-stop gradient derived from the entity's name. It sits in
// data-display because that is what it is - the mark at the head of a row, next to a name.
//
// WHERE THE TWO COLOURS COME FROM, now that the six-hex table this used to read is gone. The pair
// is computed from the seed hash AND the live --primary token, in CSS, by relative colour syntax:
//     oklch(from var(--primary) calc(l + 0.07) c calc(h + 120))
// The seed picks one of twelve 30deg hue steps; the two stops straddle the brand's own lightness
// by +-0.07, which is what makes it read as a gradient rather than a flat tile.
//
// Derived rather than a fresh "neutral" table, for three reasons:
//  1. A table is literal colour in a component (DESIGN.md rule 1), and a neutral one is still
//     somebody's six hexes - the exact thing this file was cleaned of.
//  2. THE INK ON TOP MOVES AND A TABLE CANNOT FOLLOW IT. The letter draws in
//     --primary-foreground: white in light mode, near-black in 9 of the 10 dark palettes. Over
//     10 palettes x 2 modes the old fixed pairs put that ink at 2.51:1 at worst (#3a4bc0 under
//     aubergine dark's #171718). Anchoring both stops to --primary's own L and C keeps the tile
//     inside the pairing its palette was authored for: worst midpoint - where the glyph actually
//     sits - 2.59:1, in paper dark, whose own --primary-foreground on --primary is 3.00:1. So the
//     mark is never more than ~0.4 off the theme's own primary button; excluding paper the floor
//     is 3.34:1. Measured in Chrome, canvas-sampled after gamut mapping, 12 seeds x 20 combos.
//  3. It follows the theme for free - ten palettes, six presets and the custom editor all
//     recolour these marks with no code here.
// THE COST, stated: in an achromatic palette (graphite, c ~ 0) rotating hue does nothing and every
// avatar draws the same tile - measured rgb(47,47,47) -> rgb(23,23,23) for all twelve seeds. That
// palette's thesis is "no hue anywhere", so the mark obeys it and the letter does the
// distinguishing. A product that wants hues there anyway passes `branding.palette`.

// The minimum an entity's branding has to carry for this mark: the letter and the two gradient
// stops. Declared locally (a structural subset of the host app's richer Branding record) so the
// package never reaches into domain types - an app `Branding` is assignable to this as-is.
export type GradientMarkBranding = {
    mark?: string;
    palette?: [string, string];
};

/**
 * The deterministic stop pair for a seed: two CSS colours, not two hexes. Same seed → same pair,
 * in every process, without a lookup table. Exported because node avatars and any surface that
 * needs the gradient without the letter (a chip, a spark, a canvas node) must derive it the same
 * way - two implementations of this hash is how two surfaces end up disagreeing about a colour.
 */
export function gradientPairFor(seed: string): [string, string] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = (h % 12) * 30;
    // +-0.07 of lightness and 22deg of hue between the stops. Both numbers are as large as they
    // go before the tile stops reading as one colour: the midpoint - where the glyph sits - is
    // fixed at the brand's own L whatever the spread, but the far stop pays for it (2.04:1 under
    // the ink at +-0.07 in paper dark, 1.85:1 at +-0.10). Corners, not the letter.
    return [
        `oklch(from var(--primary) calc(l + 0.07) c calc(h + ${hue}))`,
        `oklch(from var(--primary) calc(l - 0.07) c calc(h + ${hue + 22}))`,
    ];
}

// An entity's generated logo: its `mark` letter on its two-colour gradient. Used EVERYWHERE an
// entity avatar appears (rail, chat header, cards, console, inbox, home). Falls back
// deterministically to first-letter + gradientPairFor(name) when the entity has no persisted
// branding yet (drafts, demos, pre-migration rows), so it always renders a stable mark.
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
    radius?: number; // px corner radius; defaults to ~26% of size (matches the spec letterhead)
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
                // Two properties, not one shorthand, on purpose: a browser without relative colour
                // syntax (pre Chrome 119 / Safari 16.4 / Firefox 128) drops the gradient and keeps
                // the solid brand tile. One `background` shorthand would drop both and leave the
                // ink drawing on nothing.
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
