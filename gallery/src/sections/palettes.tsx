import {
    PalettePicker,
    THEME_PALETTES,
    type ThemePalette,
    themePaletteStyle,
    themePaletteSwatch,
} from "obp-ui";
import type { CSSProperties } from "react";
import { Api, Note, Spec } from "../kit";

// Each card below carries its own token values inline, so all twenty tiles (ten palettes ×
// two modes) are on screen at once regardless of which theme the page itself is in. That is
// the honest way to show a palette: side by side with its own dark mode, not one at a time.

function PaletteCard({ palette: p, mode }: { palette: ThemePalette; mode: "light" | "dark" }) {
    return (
        <div
            className="rounded-lg border border-border bg-background p-3"
            style={themePaletteStyle(p[mode], mode) as CSSProperties}
        >
            <div className="rounded-md border border-border bg-card p-3 shadow-e1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{p.name}</span>
                    <span className="font-mono text-sm text-faint">{mode}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">Muted ink on paper.</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-primary px-2 py-1 text-sm font-medium text-primary-foreground">
                        Button
                    </span>
                    <span className="rounded bg-accent px-2 py-1 text-sm text-accent-foreground">
                        Accent
                    </span>
                    <span className="rounded bg-success-soft px-2 py-1 text-sm text-success">
                        Done
                    </span>
                    <span className="rounded bg-destructive-soft px-2 py-1 text-sm text-destructive">
                        Blocked
                    </span>
                </div>
            </div>
        </div>
    );
}

export function PalettesSection() {
    return (
        <>
            <Spec
                name="PalettePicker"
                note="The chooser: ten presets, plus a custom editor with a real colour picker. Live - it retints this whole page."
            >
                <div className="flex flex-wrap items-center gap-4">
                    <PalettePicker />
                    <PalettePicker compact />
                    <Note>
                        Left: with the palette name. Right:{" "}
                        <span className="font-mono">compact</span>, for a tight header.
                    </Note>
                </div>
            </Spec>

            <Spec
                name="THEME_PALETTES"
                note="Ten palettes, each drawn in both modes. Nine of them hold the surfaces achromatic and put every bit of the identity in the brand, which runs as saturated as sRGB allows at a lightness that still reads 4.5:1 on the page. Paper, the authored theme, is the exception."
                bare
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {THEME_PALETTES.map((p) => (
                        <div key={p.id} className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span
                                    aria-hidden
                                    className="flex size-5 flex-none overflow-hidden rounded-full border border-border"
                                >
                                    {themePaletteSwatch(p, "light").map((c) => (
                                        <span
                                            key={c}
                                            className="h-full flex-1"
                                            style={{ background: c }}
                                        />
                                    ))}
                                </span>
                                <span className="font-mono text-sm font-semibold">{p.id}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{p.note}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <PaletteCard palette={p} mode="light" />
                                <PaletteCard palette={p} mode="dark" />
                            </div>
                        </div>
                    ))}
                </div>
            </Spec>

            <Spec
                name="Parts a host wires up"
                note="The controller mirrors the theme controller, on the same namespace."
            >
                <Api
                    items={[
                        {
                            name: "initPalette()",
                            note: "Apply the stored palette and keep applying it across theme changes. Call once at boot, next to initTheme(). Returns a teardown.",
                        },
                        {
                            name: "createThemePalette({ namespace })",
                            note: "Own controller for an app that must not share the default preference key.",
                        },
                        {
                            name: "setPaletteId(id) / getPaletteId()",
                            note: "The selected palette. Selecting the default removes the stored key.",
                        },
                        {
                            name: "setCustomPalette(palette) / getCustomPalette()",
                            note: "The user's own twelve colours, persisted through the storage seam like every other preference.",
                        },
                        {
                            name: "themePaletteStyle(colors, mode)",
                            note: "The token overrides as a style object - what the cards on this page use to draw a palette that is not the active one.",
                        },
                        {
                            name: "themePaletteSwatch(palette, mode)",
                            note: "Page, paper, line, brand: the four colours that identify a palette at a glance.",
                        },
                        {
                            name: "THEME_PALETTES / themePaletteFor(id)",
                            note: "The ten, and a lookup.",
                            value: `${THEME_PALETTES.length} palettes`,
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
