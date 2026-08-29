"use client";

import { PipetteIcon } from "lucide-react";
import {
    type ComponentProps,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import { cn } from "../lib/cn";
import { type Hsv, hexToHsv, hsvToHex, readableOn } from "../lib/color";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type ColorPickerProps = {
    value: string;
    onChange: (hex: string) => void;
    swatches?: string[];
    className?: string;
};

export function ColorPicker({ value, onChange, swatches, className }: ColorPickerProps) {
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 0, s: 0.75, v: 0.9 });
    const [text, setText] = useState(value);
    const hsvRef = useRef(hsv);
    hsvRef.current = hsv;

    useEffect(() => {
        const incoming = hexToHsv(value);
        if (!incoming) return;
        setText(value);
        if (hsvToHex(hsvRef.current).toLowerCase() === value.toLowerCase()) return;
        setHsv({
            ...incoming,
            h: incoming.s === 0 || incoming.v === 0 ? hsvRef.current.h : incoming.h,
        });
    }, [value]);

    const commit = useCallback(
        (next: Hsv) => {
            setHsv(next);
            const hex = hsvToHex(next);
            setText(hex);
            onChange(hex);
        },
        [onChange],
    );

    const hex = hsvToHex(hsv);
    const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });

    const track = (e: React.PointerEvent<HTMLDivElement>, to: (x: number, y: number) => Hsv) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        commit(
            to(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)),
        );
    };

    const areaAt = (x: number, y: number): Hsv => ({ ...hsvRef.current, s: x, v: 1 - y });
    const hueAt = (x: number): Hsv => ({ ...hsvRef.current, h: x * 360 });

    const step = (e: React.KeyboardEvent, apply: (dx: number, dy: number) => void) => {
        const d = e.shiftKey ? 5 : 1;
        const map: Record<string, [number, number]> = {
            ArrowLeft: [-d, 0],
            ArrowRight: [d, 0],
            ArrowUp: [0, -d],
            ArrowDown: [0, d],
        };
        const move = map[e.key];
        if (!move) return;
        e.preventDefault();
        apply(move[0], move[1]);
    };

    return (
        <div className={cn("w-full space-y-3", className)}>
            <div
                role="slider"
                tabIndex={0}
                aria-label="Saturation and brightness"
                aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
                aria-valuenow={Math.round(hsv.v * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-40 w-full cursor-crosshair touch-none rounded-md border border-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                style={{
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
                }}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    track(e, areaAt);
                }}
                onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e, areaAt);
                }}
                onKeyDown={(e) =>
                    step(e, (dx, dy) =>
                        commit({
                            ...hsv,
                            s: clamp01(hsv.s + dx * 0.02),
                            v: clamp01(hsv.v - dy * 0.02),
                        }),
                    )
                }
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                    style={{
                        left: `${hsv.s * 100}%`,
                        top: `${(1 - hsv.v) * 100}%`,
                        background: hex,
                    }}
                />
            </div>

            <div
                role="slider"
                tabIndex={0}
                aria-label="Hue"
                aria-valuenow={Math.round(hsv.h)}
                aria-valuemin={0}
                aria-valuemax={360}
                className="relative h-4 w-full cursor-ew-resize touch-none rounded-full border border-border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                style={{
                    background:
                        "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                }}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    track(e, (x) => hueAt(x));
                }}
                onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e, (x) => hueAt(x));
                }}
                onKeyDown={(e) =>
                    step(e, (dx) => commit({ ...hsv, h: (hsv.h + dx * 4 + 360) % 360 }))
                }
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                    style={{ left: `${(hsv.h / 360) * 100}%`, background: hueHex }}
                />
            </div>

            <div className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="size-9 flex-none rounded-md border border-border"
                    style={{ background: hex }}
                />
                <Input
                    aria-label="Hex colour"
                    spellCheck={false}
                    className="font-mono"
                    value={text}
                    onChange={(e) => {
                        const next = e.target.value;
                        setText(next);
                        const parsed = hexToHsv(next);
                        if (!parsed) return;
                        const full = hsvToHex(parsed);
                        setHsv({
                            ...parsed,
                            h: parsed.s === 0 || parsed.v === 0 ? hsvRef.current.h : parsed.h,
                        });
                        onChange(full);
                    }}
                    onBlur={() => setText(hex)}
                />
                <EyeDropperButton onPick={(picked) => commit(hexToHsv(picked) ?? hsv)} />
            </div>

            {swatches && swatches.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {swatches.map((s) => (
                        <button
                            key={s}
                            type="button"
                            title={s}
                            aria-label={s}
                            className={cn(
                                "size-6 rounded-md border border-border transition-none",
                                s.toLowerCase() === hex.toLowerCase() &&
                                    "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                            )}
                            style={{ background: s }}
                            onClick={() => {
                                const parsed = hexToHsv(s);
                                if (parsed) commit(parsed);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
    const [supported, setSupported] = useState(false);
    useEffect(() => setSupported(typeof window !== "undefined" && "EyeDropper" in window), []);
    if (!supported) return null;
    return (
        <button
            type="button"
            aria-label="Pick a colour from the screen"
            className="flex size-9 flex-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={async () => {
                try {
                    const Ctor = (
                        window as unknown as {
                            EyeDropper: new () => {
                                open: () => Promise<{ sRGBHex: string }>;
                            };
                        }
                    ).EyeDropper;
                    const { sRGBHex } = await new Ctor().open();
                    onPick(sRGBHex);
                } catch {}
            }}
        >
            <PipetteIcon className="size-4" />
        </button>
    );
}

export type ColorFieldProps = Omit<ComponentProps<"button">, "value" | "onChange"> & {
    label: ReactNode;
    value: string;
    onChange: (hex: string) => void;
    swatches?: string[];
};

export function ColorField({
    label,
    value,
    onChange,
    swatches,
    className,
    ...props
}: ColorFieldProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex w-full items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 text-left text-sm hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                        className,
                    )}
                    {...props}
                >
                    <span
                        aria-hidden
                        className="grid size-7 flex-none place-items-center rounded border border-border font-mono text-sm"
                        style={{ background: value, color: readableOn(value) }}
                    />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{label}</span>
                        <span className="block truncate font-mono text-sm text-faint">{value}</span>
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <ColorPicker value={value} onChange={onChange} swatches={swatches} />
            </PopoverContent>
        </Popover>
    );
}
