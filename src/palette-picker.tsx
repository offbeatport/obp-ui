"use client";

import { CheckIcon, PaletteIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "./lib/cn";
import {
    CUSTOM_PALETTE_ID,
    DEFAULT_PALETTE_ID,
    THEME_PALETTES,
    type ThemePalette,
    type ThemePaletteColors,
    type ThemePaletteController,
    themePalette as defaultPalette,
    themePaletteFor,
    themePaletteStyle,
    themePaletteSwatch,
} from "./lib/palette";
import { type Theme, type ThemeController, theme as defaultTheme } from "./lib/theme";
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

// The chrome for choosing a palette: ten presets in a popover, and a custom editor that
// exposes the twelve colours a palette is actually made of.
//
// The editor edits ONE MODE AT A TIME, and says which. A colour that looks right on cream is
// rarely the same colour that looks right on near-black, so a single set of pickers driving
// both modes would only ever be half correct. It seeds from whichever preset you were on, so
// "Nordic but the brand is our green" is two clicks and one drag, not twelve pickers.

/** The order the editor lists them in - surfaces, then ink, then lines, then brand. */
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

export type PalettePickerProps = {
    palette?: ThemePaletteController;
    theme?: ThemeController;
    /** Drop the name, keep the chip. For a tight header or a toolbar. */
    compact?: boolean;
    className?: string;
};

export function PalettePicker({
    palette: controller = defaultPalette,
    theme = defaultTheme,
    compact,
    className,
}: PalettePickerProps) {
    const [id, setId] = useState(DEFAULT_PALETTE_ID);
    const [custom, setCustomState] = useState<ThemePalette | null>(null);
    const [mode, setMode] = useState<Theme>("light");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);

    // Read after mount: SSR and the pre-paint script disagree about nothing here, but the
    // stored value is only readable in the browser.
    useEffect(() => {
        const sync = () => {
            setId(controller.getPaletteId());
            setCustomState(controller.getCustomPalette());
            setMode(theme.getTheme());
        };
        sync();
        const offPalette = controller.onPaletteChange(sync);
        const offTheme = theme.onThemeChange(sync);
        return () => {
            offPalette();
            offTheme();
        };
    }, [controller, theme]);

    const current =
        id === CUSTOM_PALETTE_ID && custom ? custom : (themePaletteFor(id) ?? THEME_PALETTES[0]);

    const startCustom = () => {
        // Seed from what is on screen, so the editor opens on the palette you were looking at.
        const seed = custom ?? current;
        controller.setCustomPalette({
            ...seed,
            id: CUSTOM_PALETTE_ID,
            name: "Custom",
            note: "Your colours.",
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
                        <Chip palette={current} mode={mode} />
                        {!compact && <span>{current.name}</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-2">
                    <div className="max-h-[60vh] overflow-y-auto">
                        {THEME_PALETTES.map((p) => (
                            <PaletteRow
                                key={p.id}
                                palette={p}
                                mode={mode}
                                selected={p.id === id}
                                onSelect={() => {
                                    controller.setPaletteId(p.id);
                                    setOpen(false);
                                }}
                            />
                        ))}
                        {custom && (
                            <PaletteRow
                                palette={custom}
                                mode={mode}
                                selected={id === CUSTOM_PALETTE_ID}
                                onSelect={() => {
                                    controller.setPaletteId(CUSTOM_PALETTE_ID);
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
                        {custom ? "Edit custom palette…" : "Make a custom palette…"}
                    </button>
                </PopoverContent>
            </Popover>

            <CustomPaletteDialog
                open={editing}
                onOpenChange={setEditing}
                controller={controller}
                theme={theme}
            />
        </>
    );
}

/** The four-colour identity chip: page, paper, line, brand. */
function Chip({ palette: p, mode }: { palette: ThemePalette; mode: Theme }) {
    return (
        <span
            aria-hidden
            className="flex size-5 flex-none overflow-hidden rounded-full border border-border"
        >
            {themePaletteSwatch(p, mode).map((c, i) => (
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

function PaletteRow({
    palette: p,
    mode,
    selected,
    onSelect,
}: {
    palette: ThemePalette;
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
            <Chip palette={p} mode={mode} />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                    {p.note}
                </span>
            </span>
            {selected && <CheckIcon className="mt-0.5 size-4 flex-none text-primary" />}
        </button>
    );
}

function CustomPaletteDialog({
    open,
    onOpenChange,
    controller,
    theme,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    controller: ThemePaletteController;
    theme: ThemeController;
}) {
    const [draft, setDraft] = useState<ThemePalette | null>(null);
    const [mode, setMode] = useState<Theme>("light");

    useEffect(() => {
        if (!open) return;
        setDraft(controller.getCustomPalette());
        setMode(theme.getTheme());
    }, [open, controller, theme]);

    if (!draft) return null;

    const set = (key: keyof ThemePaletteColors, hex: string) => {
        const next: ThemePalette = { ...draft, [mode]: { ...draft[mode], [key]: hex } };
        setDraft(next);
        controller.setCustomPalette(next); // live - the window behind the dialog retints as you drag
    };

    const reset = (from: ThemePalette) => {
        const next: ThemePalette = {
            ...from,
            id: CUSTOM_PALETTE_ID,
            name: "Custom",
            note: "Your colours.",
        };
        setDraft(next);
        controller.setCustomPalette(next);
    };

    // Every colour in the palette, offered as quick picks inside each picker.
    const swatches = [
        ...new Set(
            Object.values(draft[mode]).filter((v) => typeof v === "string" && v.startsWith("#")),
        ),
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Custom palette</DialogTitle>
                    <DialogDescription>
                        Twelve colours make a palette. Everything else - the status language,
                        radius, type - is shared by every theme on purpose. Edits apply live.
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
                    <span className="text-sm text-muted-foreground">editing the {mode} mode</span>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">Start from</span>
                        {THEME_PALETTES.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                title={`Start from ${p.name}`}
                                aria-label={`Start from ${p.name}`}
                                onClick={() => reset(p)}
                                className="rounded-full ring-offset-popover hover:ring-2 hover:ring-ring hover:ring-offset-2"
                            >
                                <Chip palette={p} mode={mode} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {FIELDS.map((f) => (
                        <div key={f.key}>
                            <ColorField
                                label={f.label}
                                value={String(draft[mode][f.key] ?? "#000000")}
                                onChange={(hex) => set(f.key, hex)}
                                swatches={swatches}
                            />
                            <p className="mt-1 px-1 text-sm text-faint">{f.hint}</p>
                        </div>
                    ))}
                </div>

                <Preview colors={draft[mode]} mode={mode} />

                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => reset(THEME_PALETTES[0])}>
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
 * The palette drawn on itself. It carries its OWN token values inline, so it shows the mode
 * being edited even while the app around it is in the other one.
 */
function Preview({ colors, mode }: { colors: ThemePaletteColors; mode: Theme }) {
    return (
        <div
            // `mode` as a class, not just tokens: it is what keeps the page's `dark:` utilities
            // out of a light preview and vice versa - see the custom variant in tokens.css.
            className={cn("rounded-lg border border-border bg-background p-4", mode)}
            style={themePaletteStyle(colors, mode) as React.CSSProperties}
        >
            <div className="rounded-md border border-border bg-card p-3 shadow-e1">
                <p className="text-sm font-semibold text-foreground">Live preview</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Muted ink on paper. <span className="text-faint">Faint ink.</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                        Primary
                    </span>
                    <span className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                        Accent
                    </span>
                    <span className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
                        Secondary
                    </span>
                    <span className="rounded-md bg-success-soft px-3 py-1.5 text-sm text-success">
                        Success
                    </span>
                    <span className="rounded-md bg-destructive-soft px-3 py-1.5 text-sm text-destructive">
                        Blocked
                    </span>
                </div>
            </div>
        </div>
    );
}
