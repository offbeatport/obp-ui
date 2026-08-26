// The small amount of colour maths the kit needs: hex ⇄ RGB ⇄ HSV for the picker, and
// relative luminance so a swatch can pick its own readable label colour.
//
// Deliberately not a colour library. Everything here is sRGB and hex, because that is what
// the tokens are written in and what a <input> round-trips cleanly. Anything more ambitious
// (OKLCH ramps, gamut mapping) belongs in whatever generates a palette, not at runtime.

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** "#abc" | "abc" | "#aabbcc" → {r,g,b}. Null when it isn't a hex colour. */
export function hexToRgb(hex: string): Rgb | null {
    const h = hex.trim().replace(/^#/, "");
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    return {
        r: Number.parseInt(full.slice(0, 2), 16),
        g: Number.parseInt(full.slice(2, 4), 16),
        b: Number.parseInt(full.slice(4, 6), 16),
    };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === R) h = ((G - B) / d) % 6;
        else if (max === G) h = (B - R) / d + 2;
        else h = (R - G) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    const i = Math.floor((((h % 360) + 360) % 360) / 60);
    const [r, g, b] = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
    ][i] as [number, number, number];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export const hexToHsv = (hex: string): Hsv | null => {
    const rgb = hexToRgb(hex);
    return rgb && rgbToHsv(rgb);
};

export const hsvToHex = (hsv: Hsv): string => rgbToHex(hsvToRgb(hsv));

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = [rgb.r, rgb.g, rgb.b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever is more readable on `hex`. For labels drawn on a swatch. */
export const readableOn = (hex: string): "#000000" | "#ffffff" =>
    contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000";
