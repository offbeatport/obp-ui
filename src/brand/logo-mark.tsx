import type { CSSProperties } from "react";
import { cn } from "../lib/cn";

// The product's brand tile: a rounded square in the product tint with one letter on it.
// The gradient + a subtle top bevel are inlined here (brand identity, like an avatar tint);
// the outer glow/halo was intentionally dropped.
//
// The defaults reproduce the cslopslop "C" mark EXACTLY - a 28px (`size-7`) terracotta tile,
// `rounded-[9px]`, `text-sm`, `--primary` as the gradient's far stop. `size` scales that same
// geometry rather than inventing new numbers: radius is 32% of the box (9/28) and the letter
// 50% (14/28), i.e. the ratios the default class string already encodes.
export function LogoMark({
    letter = "C",
    tint = "var(--primary)",
    highlight = "#e08458",
    size,
    className,
    style,
}: {
    letter?: string;
    tint?: string; // the tile's base colour - the gradient's far stop
    highlight?: string; // the lit corner - the gradient's near stop
    size?: number; // px; omit to keep the default size-7 tile (or resize via className)
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <span
            style={{
                background: `radial-gradient(circle at 32% 28%, ${highlight}, ${tint})`,
                boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
                ...(size != null
                    ? {
                          width: size,
                          height: size,
                          borderRadius: Math.round(size * 0.32),
                          fontSize: Math.round(size * 0.5),
                      }
                    : null),
                ...style,
            }}
            className={cn(
                "grid size-7 flex-none place-items-center rounded-[9px] text-sm font-bold text-white",
                className,
            )}
        >
            {letter}
        </span>
    );
}
