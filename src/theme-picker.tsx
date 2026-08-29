"use client";

import { CheckIcon, PaletteIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { cn } from "./lib/cn";
import { THEME_PALETTES, type ThemePalette } from "./lib/palette";
import { type Theme, type ThemeController, theme as defaultTheme } from "./lib/theme";
import {
    CUSTOM_PRESET_ID,
    DEFAULT_PRESET_ID,
    RADIUS_STEPS,
    SPACE_STEPS,
    THEME_PRESETS,
    TYPE_PAIRINGS,
    type ThemePreset,
    type ThemePresetController,
    themePresets as defaultPresets,
    radiusStepFor,
    spaceStepFor,
    themePresetFor,
    themePresetStyle,
    themePresetSwatch,
    typePairingFor,
} from "./lib/theme-preset";
import {
    Button,
    ColorField,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Separator,
} from "./primitives";

const FIELDS: { key: keyof ThemePreset["light"]; label: string; hint: string }[] = [
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

function axisLine(p: ThemePreset): string {
    return [
        p.palette === CUSTOM_PRESET_ID ? "Custom colours" : (p.palette ?? "-"),
        typePairingFor(p.type)?.name ?? p.type,
        radiusStepFor(p.radius)?.name ?? p.radius,
        spaceStepFor(p.space)?.name ?? p.space,
    ].join(" · ");
}

export type ThemePickerProps = {
    presets?: ThemePresetController;
    theme?: ThemeController;
    compact?: boolean;
    className?: string;
};

export function ThemePicker({
    presets: controller = defaultPresets,
    theme = defaultTheme,
    compact,
    className,
}: ThemePickerProps) {
    const [id, setId] = useState(DEFAULT_PRESET_ID);
    const [custom, setCustomState] = useState<ThemePreset | null>(null);
    const [mode, setMode] = useState<Theme>("light");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [seed, setSeed] = useState<ThemePreset | null>(null);

    useEffect(() => {
        const sync = () => {
            setId(controller.getThemePresetId());
            setCustomState(controller.getCustomTheme());
            setMode(theme.getTheme());
        };
        sync();
        const offPreset = controller.onThemePresetChange(sync);
        const offTheme = theme.onThemeChange(sync);
        return () => {
            offPreset();
            offTheme();
        };
    }, [controller, theme]);

    const current =
        id === CUSTOM_PRESET_ID && custom ? custom : (themePresetFor(id) ?? THEME_PRESETS[0]);

    const startCustom = () => {
        setSeed({
            ...(custom ?? current),
            id: CUSTOM_PRESET_ID,
            name: "Custom",
            note: "Your theme.",
        });
        setOpen(false);
        setEditing(true);
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("gap-2", className)}>
                        <PaletteIcon />
                        <Chip preset={current} mode={mode} />
                        {!compact && <span>{current.name}</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-2">
                    <div className="max-h-[60vh] overflow-y-auto">
                        {THEME_PRESETS.map((p) => (
                            <PresetRow
                                key={p.id}
                                preset={p}
                                mode={mode}
                                selected={p.id === id}
                                onSelect={() => {
                                    controller.setThemePresetId(p.id);
                                    setOpen(false);
                                }}
                            />
                        ))}
                        {custom && (
                            <PresetRow
                                preset={custom}
                                mode={mode}
                                selected={id === CUSTOM_PRESET_ID}
                                onSelect={() => {
                                    controller.setThemePresetId(CUSTOM_PRESET_ID);
                                    setOpen(false);
                                }}
                            />
                        )}
                    </div>
                    <Separator className="my-2" />
                    <button
                        type="button"
                        onClick={startCustom}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                        <SlidersHorizontalIcon className="size-4" />
                        {custom ? "Compare presets, edit yours…" : "Compare presets, make one…"}
                    </button>
                </PopoverContent>
            </Popover>

            <CustomThemeDialog
                open={editing}
                onOpenChange={setEditing}
                controller={controller}
                theme={theme}
                seed={seed}
            />
        </>
    );
}

function Chip({
    preset,
    mode,
}: {
    preset: Pick<ThemePreset, "light" | "dark"> | ThemePalette;
    mode: Theme;
}) {
    return (
        <span
            aria-hidden
            className="flex size-5 flex-none overflow-hidden rounded-full border border-border"
        >
            {themePresetSwatch(preset, mode).map((c, i) => (
                <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed 4-stop chip, position IS the identity
                    key={i}
                    className="h-full flex-1"
                    style={{ background: c }}
                />
            ))}
        </span>
    );
}

function PresetRow({
    preset: p,
    mode,
    selected,
    onSelect,
}: {
    preset: ThemePreset;
    mode: Theme;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground",
                selected && "bg-accent/60",
            )}
        >
            <Chip preset={p} mode={mode} />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                    {p.note}
                </span>
                <span className="mt-1 block font-mono text-sm capitalize text-faint">
                    {axisLine(p)}
                </span>
            </span>
            {selected && <CheckIcon className="mt-0.5 size-4 flex-none text-primary" />}
        </button>
    );
}

function Group({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">{label}</h3>
                <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            {children}
        </section>
    );
}

function isPreset(draft: ThemePreset, p: ThemePreset): boolean {
    return (
        draft.palette === p.palette &&
        draft.type === p.type &&
        draft.radius === p.radius &&
        draft.space === p.space
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
                "rounded-md border px-3 py-2 text-left transition-colors",
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

function MiniPreview({ preset, mode }: { preset: ThemePreset; mode: Theme }) {
    return (
        <span
            className={cn("block rounded-lg border border-border bg-background p-2", mode)}
            style={themePresetStyle(preset, mode) as React.CSSProperties}
        >
            <span className="block rounded-xl border border-border bg-card p-2 shadow-e1">
                <span className="flex items-baseline justify-between gap-1">
                    <span className="font-display text-base text-foreground">Aa</span>
                    <span className="font-mono text-sm text-faint">{mode}</span>
                </span>
                <span className="mt-1 flex items-center gap-1">
                    <span className="h-6 flex-1 rounded-lg bg-primary" />
                    <span className="h-6 w-6 flex-none rounded-lg bg-accent" />
                    <span className="h-6 w-6 flex-none rounded-lg border border-input" />
                </span>
            </span>
        </span>
    );
}

function CustomThemeDialog({
    open,
    onOpenChange,
    controller,
    theme,
    seed,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    controller: ThemePresetController;
    theme: ThemeController;
    seed: ThemePreset | null;
}) {
    const [draft, setDraft] = useState<ThemePreset | null>(null);
    const [mode, setMode] = useState<Theme>("light");

    useEffect(() => {
        if (!open) return;
        setDraft(seed ?? controller.getCustomTheme());
        setMode(theme.getTheme());
    }, [open, seed, controller, theme]);

    if (!draft) return null;

    const commit = (next: ThemePreset) => {
        setDraft(next);
        controller.setCustomTheme(next);
    };

    const setColor = (key: keyof ThemePreset["light"], hex: string) =>
        commit({
            ...draft,
            palette: CUSTOM_PRESET_ID,
            [mode]: { ...draft[mode], [key]: hex },
        });

    const setPalette = (p: ThemePalette) =>
        commit({ ...draft, palette: p.id, light: p.light, dark: p.dark });

    const resetTo = (from: ThemePreset) =>
        commit({ ...from, id: CUSTOM_PRESET_ID, name: "Custom", note: "Your theme." });

    const swatches = [
        ...new Set(
            Object.values(draft[mode]).filter((v) => typeof v === "string" && v.startsWith("#")),
        ),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Custom theme</DialogTitle>
                    <DialogDescription>
                        Every preset in both modes, then the four axes it is made of: twelve
                        colours, a font pairing, a radius step and a density step. The status
                        language and the type scale are shared by every theme on purpose. Edits
                        apply live.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md border border-border p-0.5">
                        {(["light", "dark"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => {
                                    setMode(m);
                                    theme.setThemePref(m);
                                }}
                                className={cn(
                                    "rounded px-3 py-1 text-sm font-medium capitalize",
                                    mode === m
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                        colours edit the {mode} mode; type, radius and space apply to both
                    </span>
                </div>

                <div className="max-h-[46vh] space-y-6 overflow-y-auto pr-1">
                    <Group
                        label="Preset"
                        hint="all six in both modes - click one to start from it, all four axes"
                    >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {THEME_PRESETS.map((p) => (
                                <Option
                                    key={p.id}
                                    selected={isPreset(draft, p)}
                                    onSelect={() => resetTo(p)}
                                    title={p.note}
                                >
                                    <span className="block text-sm font-medium">{p.name}</span>
                                    <span className="mt-0.5 block font-mono text-sm capitalize leading-snug text-faint">
                                        {axisLine(p)}
                                    </span>
                                    <span className="mt-1.5 grid grid-cols-2 gap-1.5">
                                        <MiniPreview preset={p} mode="light" />
                                        <MiniPreview preset={p} mode="dark" />
                                    </span>
                                </Option>
                            ))}
                        </div>
                    </Group>

                    <Group
                        label="Colour"
                        hint="ten palettes, then twelve pickers - colours only; type, radius and space survive"
                    >
                        <div className="flex flex-wrap items-center gap-1.5">
                            {THEME_PALETTES.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    title={`Colours from ${p.name}`}
                                    aria-label={`Colours from ${p.name}`}
                                    onClick={() => setPalette(p)}
                                    className={cn(
                                        "rounded-full ring-offset-popover hover:ring-2 hover:ring-ring hover:ring-offset-2",
                                        draft.palette === p.id &&
                                            "ring-2 ring-primary ring-offset-2",
                                    )}
                                >
                                    <Chip preset={p} mode={mode} />
                                </button>
                            ))}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {FIELDS.map((f) => (
                                <div key={f.key}>
                                    <ColorField
                                        label={f.label}
                                        value={String(draft[mode][f.key] ?? "#000000")}
                                        onChange={(hex) => setColor(f.key, hex)}
                                        swatches={swatches}
                                    />
                                    <p className="mt-1 px-1 text-sm text-faint">{f.hint}</p>
                                </div>
                            ))}
                        </div>
                    </Group>

                    <Group
                        label="Type"
                        hint="the app must import the stylesheet that loads these faces"
                    >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {TYPE_PAIRINGS.map((t) => (
                                <Option
                                    key={t.id}
                                    selected={draft.type === t.id}
                                    onSelect={() => commit({ ...draft, type: t.id })}
                                    title={t.note}
                                >
                                    <span
                                        className="block text-lg"
                                        style={{ fontFamily: t.display }}
                                    >
                                        {t.name}
                                    </span>
                                    <span
                                        className="mt-0.5 block truncate text-sm text-muted-foreground"
                                        style={{ fontFamily: t.sans }}
                                    >
                                        Body text sample
                                    </span>
                                    <span
                                        className="mt-0.5 block text-sm text-faint"
                                        style={{ fontFamily: t.mono }}
                                    >
                                        mono 0O1lI
                                    </span>
                                </Option>
                            ))}
                        </div>
                    </Group>

                    <Group label="Radius" hint="--radius for controls, --radius-card for surfaces">
                        <div className="flex flex-wrap gap-2">
                            {RADIUS_STEPS.map((r) => (
                                <Option
                                    key={r.id}
                                    selected={draft.radius === r.id}
                                    onSelect={() => commit({ ...draft, radius: r.id })}
                                    title={`${r.radius} / ${r.card}`}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="block size-9 flex-none border-2 border-current"
                                        style={{ borderRadius: r.radius }}
                                    />
                                    <span className="text-sm font-medium">{r.name}</span>
                                </Option>
                            ))}
                        </div>
                    </Group>

                    <Group label="Space" hint="one token, --spacing, multiplying every utility">
                        <div className="flex flex-wrap items-end gap-2">
                            {SPACE_STEPS.map((s) => (
                                <Option
                                    key={s.id}
                                    selected={draft.space === s.id}
                                    onSelect={() => commit({ ...draft, space: s.id })}
                                    title={s.note}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className="block w-6 flex-none rounded-sm bg-current"
                                        style={{ height: `calc(${s.spacing} * 9)` }}
                                    />
                                    <span className="text-sm font-medium">{s.name}</span>
                                </Option>
                            ))}
                        </div>
                    </Group>
                </div>

                <Preview preset={draft} mode={mode} />

                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => resetTo(THEME_PRESETS[0])}>
                        <RotateCcwIcon />
                        Reset to Paper
                    </Button>
                    <Button size="sm" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Preview({ preset, mode }: { preset: ThemePreset; mode: Theme }) {
    return (
        <div
            className={cn("rounded-lg border border-border bg-background p-4", mode)}
            style={themePresetStyle(preset, mode) as React.CSSProperties}
        >
            <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
                <p className="font-display text-xl text-foreground">Live preview</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Muted ink on paper. <span className="text-faint">Faint ink.</span>
                </p>
                <p className="mt-1 font-serif text-base italic text-muted-foreground">
                    A serif line, for the pull-quote role.
                </p>
                <p className="mt-1 font-mono text-sm text-faint">
                    mono · {spaceStepFor(preset.space)?.note ?? preset.space}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                        Primary
                    </span>
                    <span className="flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground">
                        Accent
                    </span>
                    <span className="flex h-9 items-center rounded-lg border border-input px-4 text-sm">
                        Outline
                    </span>
                    <span className="flex h-9 items-center rounded-lg bg-success-soft px-4 text-sm text-success">
                        Success
                    </span>
                    <span className="flex h-9 items-center rounded-lg bg-destructive-soft px-4 text-sm text-destructive">
                        Blocked
                    </span>
                </div>
            </div>
        </div>
    );
}
