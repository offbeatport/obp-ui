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

// The chrome for choosing a theme: six curated presets in a popover, and a custom editor that
// takes the four axes apart - colour, type, radius, space.
//
// The editor edits ONE MODE AT A TIME, and says which. A colour that looks right on cream is
// rarely the same colour that looks right on near-black, so a single set of pickers driving
// both modes would only ever be half correct. The other three axes are mode-independent and
// apply to both at once, which is why only the colour group sits under the mode switch.
//
// It seeds from whichever preset you were looking at, so "Editorial but our green and one step
// tighter" is three clicks, not twenty-one controls.
//
// It also carries the SIDE-BY-SIDE comparison: all six presets, light and dark at once, at the
// top of the editor. A popover row can only show the mode you are currently in, and comparing
// twelve tiles is precisely the moment you decide to fork one - so the comparison and the
// control that acts on it are the same surface.
//
// THE PREVIEW DRAWS ALL FOUR AXES. A colour-only preview cannot show a radius or a density
// change at all - it would sit there looking identical while the two controls that just moved
// did nothing visible. It carries the draft's tokens inline, and because custom properties
// inherit, --spacing and --radius re-measure everything inside it and nothing outside.

/** The order the editor lists them in - surfaces, then ink, then lines, then brand. */
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

/** "Slate · Operator · Sharp · Compact" - the four axes of a preset, spelled out in the list. */
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
    /** Drop the name, keep the chip. For a tight header or a toolbar. */
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
    // The draft the editor OPENS on, held here rather than in storage. See startCustom.
    const [seed, setSeed] = useState<ThemePreset | null>(null);

    // Read after mount: SSR and the pre-paint script disagree about nothing here, but the
    // stored value is only readable in the browser.
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
        // Seed from what is on screen, so the editor opens on the theme you were looking at -
        // all four axes, not just its colours.
        //
        // The seed is handed to the dialog as a prop and NOT written through the controller.
        // This entry point advertises "Compare presets", so most people who open it are here
        // to look; committing on open converted them to Custom before they touched anything -
        // measured: Paper went from 0 inline properties to 46, `obp-theme-preset` was set to
        // "custom", and Escape did not undo it, so the header read "Custom" after a reload for
        // a user who never customised anything. Worse, Custom is a frozen snapshot: that user
        // silently stops tracking any later edit to tokens.css. Every mutation in the dialog
        // goes through commit(), so writing nothing here means looking costs nothing and the
        // first real edit is still what makes you Custom.
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
                        {/* Names both jobs the dialog does. The rows above can only draw the
                            mode you are in; "compare" is the word that says the twelve-tile
                            light+dark grid is behind here. */}
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

/** The four-colour identity chip: page, paper, brand-soft, brand. */
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
                {/* The four axes, named. Without this the list looks like ten more palettes. */}
                <span className="mt-1 block font-mono text-sm capitalize text-faint">
                    {axisLine(p)}
                </span>
            </span>
            {selected && <CheckIcon className="mt-0.5 size-4 flex-none text-primary" />}
        </button>
    );
}

/** One labelled axis in the editor. */
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

/** Are all four of the draft's axes still exactly this preset's? */
function isPreset(draft: ThemePreset, p: ThemePreset): boolean {
    return (
        draft.palette === p.palette &&
        draft.type === p.type &&
        draft.radius === p.radius &&
        draft.space === p.space
    );
}

/** A selectable tile in the type / radius / space groups. */
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

/**
 * One preset, one mode, at tile size - the unit the both-modes comparison is built from.
 *
 * Everything here is drawn from the preset's OWN tokens (inline) rather than the page's, which
 * is what lets twelve of these sit on screen at once while the app stays in one theme. The
 * inner utilities are the real ones: --spacing and --radius inherit, so `p-2`, `gap-1`, `h-6`
 * and the corners re-measure per tile and the density and radius axes are *visible* here, not
 * merely named in the caption above.
 *
 * All spans: this renders inside a <button>, where a <div> is invalid HTML.
 */
function MiniPreview({ preset, mode }: { preset: ThemePreset; mode: Theme }) {
    return (
        <span
            // `mode` as a class, not just tokens - it keeps the dialog's `dark:` utilities out
            // of a light tile and vice versa (see the custom variant in tokens.css).
            className={cn("block rounded-lg border border-border bg-background p-2", mode)}
            style={themePresetStyle(preset, mode) as React.CSSProperties}
        >
            <span className="block rounded-xl border border-border bg-card p-2 shadow-e1">
                <span className="flex items-baseline justify-between gap-1">
                    {/* text-foreground is NOT redundant: a scoped preview must take its ink
                        from its own tokens, or every dark tile draws its glyph in dark ink.
                        font-display is the type axis showing itself. */}
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
    /** What to open on, from the picker. Not read from storage - opening must not write. */
    seed: ThemePreset | null;
}) {
    const [draft, setDraft] = useState<ThemePreset | null>(null);
    const [mode, setMode] = useState<Theme>("light");

    useEffect(() => {
        if (!open) return;
        // Prefer the seed the picker just computed; fall back to a stored custom theme so the
        // dialog still opens if a host renders it without going through startCustom.
        setDraft(seed ?? controller.getCustomTheme());
        setMode(theme.getTheme());
    }, [open, seed, controller, theme]);

    if (!draft) return null;

    // live - the window behind the dialog re-skins as you drag or click
    const commit = (next: ThemePreset) => {
        setDraft(next);
        controller.setCustomTheme(next);
    };

    const setColor = (key: keyof ThemePreset["light"], hex: string) =>
        // A dragged picker makes the palette provenance a lie, so drop it: the row now reads
        // "Custom colours" instead of still claiming to be Slate.
        commit({
            ...draft,
            palette: CUSTOM_PRESET_ID,
            [mode]: { ...draft[mode], [key]: hex },
        });

    /** Swap the COLOUR axis only. Type, radius and space survive - that is the whole point. */
    const setPalette = (p: ThemePalette) =>
        commit({ ...draft, palette: p.id, light: p.light, dark: p.dark });

    const resetTo = (from: ThemePreset) =>
        commit({ ...from, id: CUSTOM_PRESET_ID, name: "Custom", note: "Your theme." });

    // Every colour in the theme, offered as quick picks inside each picker.
    const swatches = [
        ...new Set(
            Object.values(draft[mode]).filter((v) => typeof v === "string" && v.startsWith("#")),
        ),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* The `sm:` prefix is load-bearing. DialogContent's own base class ends in
                `sm:max-w-lg`, and a media-query utility is emitted after every unprefixed one -
                so a plain `max-w-4xl` here loses the cascade and the dialog silently stays
                512px wide, which is what the four axes were being crammed into. */}
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
                                    theme.setThemePref(m); // show the mode you are editing
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
                    {/* Every preset, both modes, on one screen. This is the comparison the
                        gallery used to carry in a Palettes section, and it belongs here rather
                        than there: the page you compare presets on should be the page you can
                        act on the comparison from. It seeds ALL FOUR axes - which is exactly
                        what the colour chips below deliberately do not do, hence both hints
                        say so. */}
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
                                    {/* Wraps rather than truncates. Space is the last axis in
                                        the line and the hardest one to see in a 90px tile, so
                                        an ellipsis lands exactly on the word that most needs
                                        reading ("Slate · Operator · Sharp · C…"). */}
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
                                    {/* Drawn in its OWN faces, so the tile is the sample. */}
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
                                    {/* Drawn at --radius on a 36px box, the size of the control
                                        it governs. Drawing --radius-card instead turns the two
                                        largest steps into indistinguishable circles. */}
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
                                    {/* A bar at exactly the control height this step produces:
                                        calc(--spacing * 9) is what .h-9 compiles to. */}
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

/**
 * The theme drawn on itself, on all four axes. It carries its OWN token values inline, so it
 * shows the mode being edited even while the app around it is in the other one - and because
 * --spacing and --radius inherit, the padding, gaps and corners inside it are the ones the
 * draft would give the real app.
 */
function Preview({ preset, mode }: { preset: ThemePreset; mode: Theme }) {
    return (
        <div
            // `mode` as a class, not just tokens: it is what keeps the page's `dark:` utilities
            // out of a light preview and vice versa - see the custom variant in tokens.css.
            className={cn("rounded-lg border border-border bg-background p-4", mode)}
            style={themePresetStyle(preset, mode) as React.CSSProperties}
        >
            <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
                {/* text-foreground is NOT redundant: this is a SCOPED preview, so its ink has
                    to come from its own tokens. Inheriting would take the colour from the
                    dialog around it and render the dark preview's heading in dark ink. */}
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
                {/* Real utilities, not hand-set sizes: h-9/px-4/gap-2/rounded-lg are the ones
                    the axes actually move, so the row re-measures itself as you click. */}
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
