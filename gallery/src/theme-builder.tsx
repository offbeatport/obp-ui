import {
    Badge,
    Button,
    CUSTOM_PRESET_ID,
    ColorField,
    DEFAULT_PALETTE_ID,
    DEFAULT_PRESET_ID,
    Input,
    Label,
    RADIUS_STEPS,
    SPACE_STEPS,
    STATUS_KEYS,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    Separator,
    type StatusColors,
    Switch,
    THEME_PALETTES,
    THEME_PRESETS,
    TYPE_PAIRINGS,
    type ThemePalette,
    type ThemePaletteColors,
    type ThemePreset,
    cn,
    contrastRatio,
    getCustomTheme,
    getThemePreset,
    hexToHsv,
    hexToRgb,
    hsvToHex,
    makePalette,
    radiusStepFor,
    rgbToHex,
    setCustomTheme,
    setThemePresetId,
    spaceStepFor,
    themePaletteFor,
    themePresetFor,
    themePresetStyle,
    themePresetSwatch,
    typePairingFor,
} from "obp-ui";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

type Mode = "light" | "dark";

const MODES: Mode[] = ["light", "dark"];

const FIELDS: { key: keyof ThemePaletteColors; label: string; hint: string }[] = [
    { key: "background", label: "Page", hint: "The window behind everything" },
    { key: "card", label: "Paper", hint: "Cards, popovers, panels" },
    { key: "secondary", label: "Rail", hint: "Sidebars and subtle fills" },
    { key: "foreground", label: "Ink", hint: "Body text" },
    { key: "mutedForeground", label: "Muted ink", hint: "Secondary text" },
    { key: "faint", label: "Faint ink", hint: "The quietest readable text" },
    { key: "border", label: "Line", hint: "Borders and inputs" },
    { key: "borderSoft", label: "Line soft", hint: "Dividers inside a card" },
    { key: "primary", label: "Brand", hint: "Buttons, links, focus ring" },
    { key: "primaryForeground", label: "Brand ink", hint: "Text on a brand button" },
    { key: "accent", label: "Brand soft", hint: "Hover surfaces" },
    { key: "accentForeground", label: "Brand ink soft", hint: "Text on a brand-soft surface" },
];

const COLOR_ORDER = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--faint",
    "--primary",
    "--primary-foreground",
    "--accent",
    "--accent-foreground",
    "--border",
    "--border-soft",
    "--input",
    "--ring",
];

const SHADOW_ORDER = ["--shadow-e1", "--shadow-e2"];

const SHARED_ORDER = [
    "--font-sans",
    "--font-display",
    "--font-mono",
    "--font-serif",
    "--radius",
    "--radius-card",
    "--spacing",
];

const CHECKS: {
    label: string;
    floor: number;
    binding: boolean;
    fg: keyof ThemePaletteColors;
    bg: keyof ThemePaletteColors;
}[] = [
    { label: "faint ink on paper", floor: 4.55, binding: true, fg: "faint", bg: "card" },
    { label: "brand on page", floor: 4.5, binding: true, fg: "primary", bg: "background" },
    { label: "ink on paper", floor: 4.5, binding: false, fg: "foreground", bg: "card" },
    { label: "muted ink on paper", floor: 4.5, binding: false, fg: "mutedForeground", bg: "card" },
    {
        label: "brand ink on brand",
        floor: 4.5,
        binding: false,
        fg: "primaryForeground",
        bg: "primary",
    },
    {
        label: "brand ink soft on brand soft",
        floor: 4.5,
        binding: false,
        fg: "accentForeground",
        bg: "accent",
    },
];

function flatten(color: string, over: string): string {
    if (color.startsWith("#")) return color;
    const parts = color
        .match(/rgba?\(([^)]+)\)/)?.[1]
        ?.split(",")
        .map((p) => Number.parseFloat(p));
    const base = hexToRgb(over);
    if (!parts || parts.length < 3 || !base) return over;
    const [r = 0, g = 0, b = 0, a = 1] = parts;
    return rgbToHex({
        r: Math.round(r * a + base.r * (1 - a)),
        g: Math.round(g * a + base.g * (1 - a)),
        b: Math.round(b * a + base.b * (1 - a)),
    });
}

function ratioOf(
    colors: ThemePaletteColors,
    fg: keyof ThemePaletteColors,
    bg: keyof ThemePaletteColors,
): number {
    const under = colors.background;
    return contrastRatio(
        flatten(String(colors[fg] ?? ""), under),
        flatten(String(colors[bg] ?? ""), under),
    );
}

function solvePalette(hex: string): ThemePalette | null {
    const base = hexToHsv(hex);
    if (!base) return null;

    const spec = (
        primary: string,
        accent: string,
        accentForeground: string,
        darkPrimary: string,
    ) => ({
        id: CUSTOM_PRESET_ID,
        name: "Custom",
        note: "Solved from one brand colour.",
        light: { primary, accent, accentForeground },
        dark: {
            primary: darkPrimary,
            accentForeground: hsvToHex({ ...base, s: base.s * 0.45, v: 0.97 }),
        },
    });

    const accent = hsvToHex({ ...base, s: Math.min(base.s, 0.24), v: 0.95 });
    const darkPrimary = hsvToHex({ ...base, s: base.s * 0.72, v: Math.max(base.v, 0.86) });
    const page = makePalette(spec(hex, accent, hex, darkPrimary)).light.background;

    const darkenTo = (over: string, floor: number) => {
        let v = base.v;
        for (let i = 0; i < 64 && v > 0.06; i++) {
            const candidate = hsvToHex({ ...base, v });
            if (contrastRatio(candidate, over) >= floor) return candidate;
            v -= 0.015;
        }
        return hsvToHex({ ...base, v: Math.max(v, 0.06) });
    };

    return makePalette(spec(darkenTo(page, 4.55), accent, darkenTo(accent, 4.6), darkPrimary));
}

function block(selector: string, pairs: [string, string][]): string {
    const width = Math.max(...pairs.map(([k]) => k.length)) + 2;
    const body = pairs.map(([k, v]) => `    ${`${k}:`.padEnd(width)}${v};`).join("\n");
    return `${selector} {\n${body}\n}`;
}

function buildCss(preset: ThemePreset): string {
    const pick = (style: Record<string, string>, keys: string[]): [string, string][] =>
        keys.flatMap((k) => {
            const value = style[k];
            return value ? [[k, value] as [string, string]] : [];
        });
    const light = themePresetStyle(preset, "light");
    const dark = themePresetStyle(preset, "dark");
    const statusIn = (mode: Mode): string[] => {
        const overridden = new Set(Object.keys(preset.status?.[mode] ?? {}).map(STATUS_VAR));
        return STATUS_ORDER.filter((v) => overridden.has(v));
    };
    return [
        '@import "obp-ui/styles.css";',
        "",
        block(":root", [
            ...pick(light, COLOR_ORDER),
            ...pick(light, statusIn("light")),
            ...pick(light, SHADOW_ORDER),
            ...pick(light, SHARED_ORDER),
        ]),
        "",
        block(".dark", [
            ...pick(dark, COLOR_ORDER),
            ...pick(dark, statusIn("dark")),
            ...pick(dark, SHADOW_ORDER),
        ]),
        "",
    ].join("\n");
}

const SWATCH_SLOTS = ["background", "card", "accent", "primary"] as const;

const BRAND_PALETTES = new Set([
    "vercel",
    "linear",
    "github",
    "x",
    "hyperagent",
    "supabase",
    "stripe",
]);

const PALETTE_GROUPS: { label: string; has: (p: ThemePalette) => boolean }[] = [
    { label: "Authored", has: (p) => p.id === DEFAULT_PALETTE_ID },
    { label: "Quoted from a product", has: (p) => BRAND_PALETTES.has(p.id) },
    {
        label: "Generated from one hue",
        has: (p) => p.id !== DEFAULT_PALETTE_ID && !BRAND_PALETTES.has(p.id),
    },
];

const axisLine = (p: ThemePreset): string =>
    [
        p.palette === CUSTOM_PRESET_ID ? "your colours" : p.palette,
        typePairingFor(p.type)?.name ?? p.type,
        radiusStepFor(p.radius)?.name ?? p.radius,
        spaceStepFor(p.space)?.name ?? p.space,
    ].join(" · ");

function Strip({ preset }: { preset: Pick<ThemePreset, "light" | "dark"> | ThemePalette }) {
    return (
        <span
            aria-hidden
            className="grid h-7 w-14 flex-none grid-rows-2 overflow-hidden rounded-md border border-border"
        >
            {MODES.map((mode) => (
                <span key={mode} className="flex">
                    {themePresetSwatch(preset, mode).map((c, i) => (
                        <span
                            key={SWATCH_SLOTS[i]}
                            className="h-full flex-1"
                            style={{ background: c }}
                        />
                    ))}
                </span>
            ))}
        </span>
    );
}

function Option({
    selected,
    onSelect,
    title,
    children,
    className,
}: {
    selected: boolean;
    onSelect: () => void;
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onSelect}
            className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selected
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-secondary",
                className,
            )}
        >
            {children}
        </button>
    );
}

function Rail({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-foreground">
                {label}
            </h2>
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            {children}
        </section>
    );
}

const STATUS_VAR = (key: string): string =>
    key.endsWith("Foreground") ? `--${key.slice(0, -"Foreground".length)}-foreground` : `--${key}`;

const STATUS_ORDER = STATUS_KEYS.flatMap((k) => [STATUS_VAR(k), STATUS_VAR(`${k}Foreground`)]);

const CHIP_FLOOR = 5.65;

function mix(hex: string, over: string, ratio: number): string {
    const a = hexToRgb(hex);
    const b = hexToRgb(over);
    if (!a || !b) return over;
    return rgbToHex({
        r: Math.round(a.r * ratio + b.r * (1 - ratio)),
        g: Math.round(a.g * ratio + b.g * (1 - ratio)),
        b: Math.round(a.b * ratio + b.b * (1 - ratio)),
    });
}

function StatusRow({
    name,
    hue,
    ink,
    page,
    mode,
    onHue,
    onInk,
}: {
    name: string;
    hue: string;
    ink: string;
    page: string;
    mode: Mode;
    onHue: (hex: string) => void;
    onInk: (hex: string) => void;
}) {
    const soft = mix(hue, page, mode === "dark" ? 0.2 : 0.14);
    const filled = contrastRatio(ink, hue);
    const onSoft = contrastRatio(hue, soft);
    const filledPass = mode === "dark" ? filled >= CHIP_FLOOR : true;

    return (
        <div className="space-y-1.5 rounded-lg border border-border-soft p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize">{name}</span>
                <span className="flex items-center gap-1.5">
                    <span
                        className="rounded-full px-2 py-0.5 text-sm font-semibold"
                        style={{ background: soft, color: hue }}
                    >
                        soft
                    </span>
                    <span
                        className="rounded-full px-2 py-0.5 text-sm font-semibold"
                        style={{ background: hue, color: ink }}
                    >
                        filled
                    </span>
                    <span
                        title={`filled label ${filled.toFixed(2)}:1 · status text on soft ${onSoft.toFixed(2)}:1`}
                        className={cn(
                            "font-mono text-sm tabular-nums",
                            filledPass && onSoft >= 4.5
                                ? "text-success"
                                : filledPass
                                  ? "text-warning"
                                  : "text-destructive",
                        )}
                    >
                        {filled.toFixed(2)} · {onSoft.toFixed(2)}
                    </span>
                </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="flex items-center gap-1.5">
                    <ColorField label="Hue" value={hue} onChange={onHue} />
                    <HexInput value={hue} onChange={onHue} />
                </div>
                <div className="flex items-center gap-1.5">
                    <ColorField label="Ink" value={ink} onChange={onInk} />
                    <HexInput value={ink} onChange={onInk} />
                </div>
            </div>
        </div>
    );
}

function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
    const [text, setText] = useState(value);

    useEffect(() => {
        setText((current) => {
            const parsed = hexToHsv(current);
            return parsed && hsvToHex(parsed).toLowerCase() === value.toLowerCase()
                ? current
                : value;
        });
    }, [value]);

    return (
        <Input
            aria-label="Hex value"
            spellCheck={false}
            value={text}
            className="h-11 w-[5.5rem] flex-none px-2 font-mono"
            onChange={(e) => {
                setText(e.target.value);
                const parsed = hexToHsv(e.target.value);
                if (parsed) onChange(hsvToHex(parsed));
            }}
            onBlur={() => setText(value)}
        />
    );
}

function Floors({ colors }: { colors: ThemePaletteColors }) {
    return (
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {CHECKS.map((c) => {
                const r = ratioOf(colors, c.fg, c.bg);
                const pass = r >= c.floor;
                return (
                    <div key={c.label} className="flex items-baseline justify-between gap-2">
                        <dt className="truncate text-sm text-muted-foreground">
                            {c.label}
                            {c.binding && <span className="ml-1 text-faint">§1</span>}
                        </dt>
                        <dd
                            className={cn(
                                "font-mono text-sm font-semibold tabular-nums",
                                pass
                                    ? "text-success"
                                    : c.binding
                                      ? "text-destructive"
                                      : "text-warning",
                            )}
                        >
                            {r.toFixed(2)}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

function Preview({ preset, mode }: { preset: ThemePreset; mode: Mode }) {
    return (
        <div
            className={cn("rounded-xl border border-border bg-background p-5", mode)}
            style={themePresetStyle(preset, mode) as CSSProperties}
        >
            <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-2xl text-foreground">{preset.name}</p>
                    <span className="font-mono text-sm uppercase tracking-wide text-faint">
                        {mode}
                    </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    Muted ink on paper, with <span className="text-primary underline">a link</span>{" "}
                    in the brand colour.{" "}
                    <span className="text-faint">Faint ink closes the line.</span>
                </p>
                <p className="mt-1 font-serif text-base italic text-muted-foreground">
                    A serif line, for the pull-quote role.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm">Primary</Button>
                    <Button size="sm" variant="secondary">
                        Secondary
                    </Button>
                    <Button size="sm" variant="outline">
                        Outline
                    </Button>
                    <Button size="sm" variant="ghost">
                        Ghost
                    </Button>
                    <Button size="sm" variant="destructive">
                        Delete
                    </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="accent">Brand soft</Badge>
                    <Badge variant="success">Passed</Badge>
                    <Badge variant="warning">Held</Badge>
                    <Badge variant="info">Running</Badge>
                    <Badge variant="approval">Review</Badge>
                    <Badge variant="neutral">Idle</Badge>
                    <Badge variant="outline">Outline</Badge>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor={`field-${mode}`}>Field</Label>
                        <Input id={`field-${mode}`} defaultValue="value" />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                        <Switch id={`switch-${mode}`} defaultChecked />
                        <Label htmlFor={`switch-${mode}`}>Enabled</Label>
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="rounded-lg bg-secondary p-3">
                    <p className="font-mono text-sm text-faint">RAIL · SECONDARY SURFACE</p>
                    <p className="mt-1 text-sm text-foreground">
                        The sidebar fill, under the same ink.
                    </p>
                </div>
            </div>

            <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-e2">
                <p className="text-sm text-muted-foreground">Elevation two, on the page colour.</p>
            </div>
        </div>
    );
}

export function ThemeBuilderPage() {
    const [draft, setDraft] = useState<ThemePreset>(
        () =>
            getCustomTheme() ?? {
                ...getThemePreset(),
                id: CUSTOM_PRESET_ID,
                name: "Custom",
                note: "Your theme.",
            },
    );
    const [live, setLive] = useState(true);
    const [touched, setTouched] = useState(false);
    const [brand, setBrand] = useState("#7c3aed");
    const [copied, setCopied] = useState<string | null>(null);

    const edit = (next: ThemePreset | ((d: ThemePreset) => ThemePreset)) => {
        setTouched(true);
        setDraft(next);
    };

    useEffect(() => {
        if (touched && live) setCustomTheme(draft);
    }, [draft, live, touched]);

    const css = buildCss(draft);
    const json = JSON.stringify({ ...draft, id: CUSTOM_PRESET_ID }, null, 4);

    const copy = (what: string, text: string) => {
        void navigator.clipboard.writeText(text).then(() => {
            setCopied(what);
            setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
        });
    };

    const setPalette = (p: ThemePalette) =>
        edit((d) => ({ ...d, palette: p.id, light: p.light, dark: p.dark }));

    const setColor = (mode: Mode, key: keyof ThemePaletteColors, hex: string) =>
        edit((d) => ({
            ...d,
            palette: CUSTOM_PRESET_ID,
            [mode]: { ...d[mode], [key]: hex },
        }));

    const setStatus = (mode: Mode, key: keyof StatusColors, hex: string) =>
        edit((d) => ({
            ...d,
            status: { ...d.status, [mode]: { ...d.status?.[mode], [key]: hex } },
        }));

    const clearStatus = (mode: Mode) =>
        edit((d) => ({ ...d, status: { ...d.status, [mode]: undefined } }));

    const resolved: Record<Mode, Record<string, string>> = {
        light: themePresetStyle(draft, "light"),
        dark: themePresetStyle(draft, "dark"),
    };

    const presetMatch = THEME_PRESETS.find(
        (p) =>
            p.palette === draft.palette &&
            p.type === draft.type &&
            p.radius === draft.radius &&
            p.space === draft.space,
    );
    const activePalette = themePaletteFor(draft.palette);
    const activeType = typePairingFor(draft.type);

    const fromBrand = () => {
        const solved = solvePalette(brand);
        if (solved) setPalette(solved);
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
                <div className="flex flex-wrap items-center gap-3 px-6 py-3 lg:px-8">
                    <a
                        href="#tokens"
                        className="font-mono text-sm text-muted-foreground hover:text-foreground"
                    >
                        ← gallery
                    </a>
                    <h1 className="font-display text-xl font-light tracking-tight">
                        Theme builder
                    </h1>
                    <Input
                        aria-label="Theme name"
                        value={draft.name}
                        onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))}
                        className="h-8 w-40"
                    />
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <Label htmlFor="live" className="text-sm text-muted-foreground">
                            Apply to this page
                        </Label>
                        <Switch id="live" checked={live} onCheckedChange={setLive} />
                        <Button size="sm" variant="outline" onClick={() => copy("css", css)}>
                            {copied === "css" ? "Copied" : "Copy CSS"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copy("json", json)}>
                            {copied === "json" ? "Copied" : "Copy JSON"}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setThemePresetId(DEFAULT_PRESET_ID);
                                setLive(false);
                            }}
                        >
                            Reset page
                        </Button>
                    </div>
                </div>
            </header>

            <div className="grid gap-8 px-6 py-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-8">
                <aside className="space-y-7 lg:sticky lg:top-20 lg:self-start">
                    <Rail
                        label="One colour"
                        hint="Solved against the §1 floors, then the ladder does the rest."
                    >
                        <div className="flex items-center gap-2">
                            <ColorField label="Brand" value={brand} onChange={setBrand} />
                            <Button size="sm" onClick={fromBrand}>
                                Solve
                            </Button>
                        </div>
                    </Rail>

                    <Rail label="Preset" hint="All four axes at once.">
                        <Select
                            value={presetMatch?.id ?? ""}
                            onValueChange={(id) => {
                                const p = themePresetFor(String(id));
                                if (p) edit({ ...p, id: CUSTOM_PRESET_ID });
                            }}
                        >
                            <SelectTrigger className="h-auto w-full py-2">
                                <span className="flex min-w-0 items-center gap-2">
                                    <Strip preset={presetMatch ?? draft} />
                                    <span className="truncate font-medium">
                                        {presetMatch?.name ?? "Custom"}
                                    </span>
                                </span>
                            </SelectTrigger>
                            <SelectContent className="max-w-[22rem]">
                                {THEME_PRESETS.map((p) => (
                                    <SelectItem
                                        key={p.id}
                                        value={p.id}
                                        textValue={p.name}
                                        description={
                                            <span className="font-mono capitalize">
                                                {axisLine(p)}
                                            </span>
                                        }
                                    >
                                        <Strip preset={p} />
                                        <span className="font-medium">{p.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Rail>

                    <Rail label="Palette" hint="Colours only - type, radius and space survive.">
                        <Select
                            value={draft.palette}
                            onValueChange={(id) => {
                                const p = themePaletteFor(String(id));
                                if (p) setPalette(p);
                            }}
                        >
                            <SelectTrigger className="h-auto w-full py-2">
                                <span className="flex min-w-0 items-center gap-2">
                                    {activePalette ? (
                                        <Strip preset={activePalette} />
                                    ) : (
                                        <Strip preset={draft} />
                                    )}
                                    <span className="truncate font-medium">
                                        {activePalette?.name ?? "Your colours"}
                                    </span>
                                </span>
                            </SelectTrigger>
                            <SelectContent className="max-w-[22rem]">
                                {PALETTE_GROUPS.map((group) => (
                                    <SelectGroup key={group.label}>
                                        <SelectLabel>{group.label}</SelectLabel>
                                        {THEME_PALETTES.filter(group.has).map((p) => (
                                            <SelectItem
                                                key={p.id}
                                                value={p.id}
                                                textValue={p.name}
                                                description={p.note}
                                            >
                                                <Strip preset={p} />
                                                <span className="font-medium">{p.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </Rail>

                    <Rail label="Type" hint="The app must import the stylesheet that loads these.">
                        <Select
                            value={draft.type}
                            onValueChange={(id) => edit((d) => ({ ...d, type: String(id) }))}
                        >
                            <SelectTrigger className="h-auto w-full py-2">
                                <span className="flex min-w-0 flex-col items-start">
                                    <span
                                        className="truncate text-base leading-tight"
                                        style={{ fontFamily: activeType?.display }}
                                    >
                                        {activeType?.name ?? draft.type}
                                    </span>
                                    <span
                                        className="truncate text-sm text-muted-foreground"
                                        style={{ fontFamily: activeType?.sans }}
                                    >
                                        Body text sample
                                    </span>
                                </span>
                            </SelectTrigger>
                            <SelectContent className="max-w-[22rem]">
                                {TYPE_PAIRINGS.map((t) => (
                                    <SelectItem
                                        key={t.id}
                                        value={t.id}
                                        textValue={t.name}
                                        description={
                                            <>
                                                <span
                                                    className="block truncate"
                                                    style={{ fontFamily: t.sans }}
                                                >
                                                    Body text sample
                                                </span>
                                                <span
                                                    className="block truncate"
                                                    style={{ fontFamily: t.mono }}
                                                >
                                                    mono 0O1lI
                                                </span>
                                            </>
                                        }
                                    >
                                        <span
                                            className="text-base leading-tight"
                                            style={{ fontFamily: t.display }}
                                        >
                                            {t.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Rail>

                    <Rail label="Radius">
                        <div className="flex flex-wrap gap-1.5">
                            {RADIUS_STEPS.map((r) => (
                                <Option
                                    key={r.id}
                                    selected={draft.radius === r.id}
                                    onSelect={() => edit((d) => ({ ...d, radius: r.id }))}
                                    title={`${r.radius} / ${r.card}`}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="block size-6 flex-none border-2 border-current"
                                        style={{ borderRadius: r.radius }}
                                    />
                                    {r.name}
                                </Option>
                            ))}
                        </div>
                    </Rail>

                    <Rail label="Space" hint="One token, --spacing, multiplying every utility.">
                        <div className="flex flex-wrap items-end gap-1.5">
                            {SPACE_STEPS.map((s) => (
                                <Option
                                    key={s.id}
                                    selected={draft.space === s.id}
                                    onSelect={() => edit((d) => ({ ...d, space: s.id }))}
                                    title={s.note}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="block w-4 flex-none rounded-sm bg-current"
                                        style={{ height: `calc(${s.spacing} * 8)` }}
                                    />
                                    {s.name}
                                </Option>
                            ))}
                        </div>
                    </Rail>
                </aside>

                <main className="min-w-0 space-y-8">
                    <div className="grid gap-6 xl:grid-cols-2">
                        {MODES.map((mode) => (
                            <section key={mode} className="min-w-0 space-y-4">
                                <Preview preset={draft} mode={mode} />

                                <div className="rounded-xl border border-border bg-card p-4">
                                    <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
                                        {mode} contrast
                                    </h3>
                                    <p className="mt-1 mb-2 text-sm text-muted-foreground">
                                        §1 marks a binding floor. The rest are advisory.
                                    </p>
                                    <Floors colors={draft[mode]} />
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
                                        {mode} colours - every one, by hand
                                    </h3>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {FIELDS.map((f) => (
                                            <div key={f.key}>
                                                <div className="flex items-center gap-1.5">
                                                    <ColorField
                                                        label={f.label}
                                                        value={String(
                                                            draft[mode][f.key] ?? "#000000",
                                                        )}
                                                        onChange={(hex) =>
                                                            setColor(mode, f.key, hex)
                                                        }
                                                        swatches={[
                                                            ...new Set(
                                                                Object.values(draft[mode]).filter(
                                                                    (v) =>
                                                                        typeof v === "string" &&
                                                                        v.startsWith("#"),
                                                                ),
                                                            ),
                                                        ]}
                                                    />
                                                    <HexInput
                                                        value={String(
                                                            draft[mode][f.key] ?? "#000000",
                                                        )}
                                                        onChange={(hex) =>
                                                            setColor(mode, f.key, hex)
                                                        }
                                                    />
                                                </div>
                                                <p className="mt-1 px-1 text-sm text-faint">
                                                    {f.hint}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
                                            {mode} status hues
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {mode === "dark"
                                                ? "A filled label must clear 5.65:1 (§1)."
                                                : "Light chips are a soft fill plus status text, so that is the pair to watch."}
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        {STATUS_KEYS.map((key) => (
                                            <StatusRow
                                                key={key}
                                                name={key}
                                                mode={mode}
                                                page={draft[mode].background}
                                                hue={resolved[mode][STATUS_VAR(key)] ?? "#000000"}
                                                ink={
                                                    resolved[mode][
                                                        STATUS_VAR(`${key}Foreground`)
                                                    ] ?? "#ffffff"
                                                }
                                                onHue={(hex) => setStatus(mode, key, hex)}
                                                onInk={(hex) =>
                                                    setStatus(mode, `${key}Foreground`, hex)
                                                }
                                            />
                                        ))}
                                    </div>
                                    {draft.status?.[mode] && (
                                        <button
                                            type="button"
                                            onClick={() => clearStatus(mode)}
                                            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                        >
                                            Put the {mode} status hues back to the kit's
                                        </button>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>

                    <section className="space-y-2">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                            <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
                                Paste this after the import
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                No JS, no rebuild, no flicker. The status hues stay the kit's on
                                purpose.
                            </p>
                        </div>
                        <pre className="max-h-[32rem] overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed text-muted-foreground">
                            {css}
                        </pre>
                    </section>
                </main>
            </div>
        </div>
    );
}
