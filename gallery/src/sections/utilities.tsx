import {
    Button,
    ClientOnly,
    ConfirmDialog,
    DEFAULT_NAMESPACE,
    Markdown,
    type ProviderId,
    ProviderLogo,
    RADIUS_STEPS,
    SPACE_STEPS,
    THEME_PALETTES,
    THEME_PRESETS,
    TYPE_PAIRINGS,
    type ThemePref,
    ThemeToggle,
    cn,
    consoleTabPref,
    createTheme,
    getTheme,
    getThemePref,
    getThemePresetId,
    onThemeChange,
    onThemePresetChange,
    prePaintScript,
    prefStorage,
    setThemePref,
    themeKey,
    toggleTheme,
} from "obp-ui";
import { useEffect, useState } from "react";
import { Api, Cell, Note, Row, Spec } from "../kit";

const PROVIDERS: ProviderId[] = [
    "anthropic",
    "openai",
    "google",
    "perplexity",
    "xai",
    "openrouter",
    "zai",
];

const SAMPLE = `## What I found

Freelancers lose ~3 weeks a year chasing invoices, and every tool for it is built for
*finance teams*, not for one person.

- **Pain:** 8.4 - they already pay for workarounds
- **Reach:** 6.1 - narrow, but reachable on one channel
- Moat: 4.7 - thin, so speed is the moat

> The wedge is the chase, not the invoice.

Run \`pnpm ui\` to see the kit. Full write-up in the [spec](#utilities).

\`\`\`ts
const score = weigh({ pain: 8.4, reach: 6.1, moat: 4.7 });
\`\`\`

---

1. Scaffold the repo
2. Landing page + waitlist
3. Stripe checkout
`;

const PREFS: ThemePref[] = ["light", "dark", "system"];

function ThemeReadout() {
    const [, bump] = useState(0);
    useEffect(() => onThemeChange(() => bump((n) => n + 1)), []);
    return (
        <Api
            items={[
                {
                    name: "getTheme()",
                    note: "the theme actually on <html> right now.",
                    value: getTheme(),
                },
                {
                    name: "getThemePref()",
                    note: 'the stored preference; absence of the key means "system".',
                    value: getThemePref(),
                },
                {
                    name: "themeKey()",
                    note: "the storage key, derived from the namespace so it cannot drift.",
                    value: themeKey(),
                },
                {
                    name: "DEFAULT_NAMESPACE",
                    note: "used when a host does not pick one; a second app on the same origin should.",
                    value: DEFAULT_NAMESPACE,
                },
                {
                    name: "prefStorage().get(themeKey())",
                    note: "what is actually persisted (localStorage unless configureStorage swapped it).",
                    value: prefStorage().get(themeKey()) ?? "null",
                },
            ]}
        />
    );
}

function PresetReadout() {
    const [, bump] = useState(0);
    useEffect(() => onThemePresetChange(() => bump((n) => n + 1)), []);
    return (
        <Api
            items={[
                {
                    name: "<ThemePicker />",
                    note: "the control itself, drawn ONCE - in this page's header. A second live picker on the page would be a second thing claiming to be the current theme. Its editor is also where all six presets are compared in both modes at once.",
                },
                {
                    name: "getThemePresetId()",
                    note: "the selected preset. Selecting the default removes the stored key.",
                    value: getThemePresetId(),
                },
                {
                    name: "initThemePreset()",
                    note: "apply the stored preset and keep applying it across light/dark changes. Call once at boot, next to initTheme(). Returns a teardown.",
                },
                {
                    name: "createThemePresets({ namespace })",
                    note: "an independent controller for an app that must not share the default preference key.",
                },
                {
                    name: "setThemePresetId / setCustomTheme / getCustomTheme",
                    note: "select a preset, or persist the user's own four axes through the same storage seam. Applying the default REMOVES every managed property rather than restating it, so the authored theme cannot drift.",
                },
                {
                    name: "themePresetStyle / themePresetSwatch",
                    note: "a preset's tokens as an inline style object, and the four colours that identify it - what draws a theme that is not the active one.",
                },
                {
                    name: "THEME_PRESETS · THEME_PALETTES",
                    note: "the six bundles, and the ten colour palettes they draw from.",
                    value: `${THEME_PRESETS.length} · ${THEME_PALETTES.length}`,
                },
                {
                    name: "TYPE_PAIRINGS · RADIUS_STEPS · SPACE_STEPS",
                    note: "the three non-colour axes. --spacing is the whole density axis: Tailwind v4 compiles every spacing utility as calc(var(--spacing) * N), so one value re-measures the kit.",
                    value: `${TYPE_PAIRINGS.length} · ${RADIUS_STEPS.length} · ${SPACE_STEPS.length}`,
                },
            ]}
        />
    );
}

export function UtilitiesSection() {
    const [killed, setKilled] = useState(false);

    return (
        <>
            <Spec name="ThemeToggle · theme controller" note="Flips and pins the resolved theme.">
                <Row className="gap-3">
                    <ThemeToggle />
                    {PREFS.map((p) => (
                        <Button key={p} size="sm" variant="outline" onClick={() => setThemePref(p)}>
                            setThemePref("{p}")
                        </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={toggleTheme}>
                        toggleTheme()
                    </Button>
                </Row>
                <div className="mt-4">
                    <ThemeReadout />
                </div>
                <Note>
                    <code>createTheme({"{ namespace }"})</code> builds an independent controller -
                    the gallery uses the default one, which is why the header toggle and these
                    buttons stay in sync. <code>initTheme()</code> runs once in{" "}
                    <code>main.tsx</code>.
                </Note>
            </Spec>

            <Spec
                name="ThemePicker · preset controller"
                note="Colour, type, radius, density — token values on <html>."
            >
                <PresetReadout />
                <Note>
                    Theme configuration has no section of its own on this page: it is the{" "}
                    <code>ThemePicker</code> in the header. A picker is only honest where it can
                    re-skin the whole page, and the comparison that used to justify a section -
                    every preset in light and dark, side by side - now sits inside that picker's
                    editor, next to the controls that act on it.
                </Note>
            </Spec>

            <Spec name="Markdown" note="Dependency-free; React nodes, no HTML injection.">
                <Markdown
                    content={SAMPLE}
                    className="max-w-prose space-y-3 break-words text-base"
                />
            </Spec>

            <Spec name="ConfirmDialog" note="Wraps a trigger; awaits onConfirm.">
                <Row>
                    <ConfirmDialog
                        trigger={<Button variant="destructive">Kill company</Button>}
                        title="Kill Ledgerly?"
                        description="The repo and the deploy stay; the agent stops working on it and the burn goes to zero."
                        confirmLabel="Kill it"
                        destructive
                        onConfirm={() => setKilled(true)}
                    />
                    <Note>confirmed: {String(killed)}</Note>
                </Row>
            </Spec>

            <Spec name="cn · ClientOnly" note="Class merger and hydration guard.">
                <Api
                    items={[
                        {
                            name: 'cn("px-2 py-1", "px-4")',
                            note: "tailwind-merge resolves the conflict; the last one wins.",
                            value: cn("px-2 py-1", "px-4"),
                        },
                        {
                            name: 'cn("hidden", false && "block")',
                            note: "clsx conditionals fall through unchanged.",
                            value: cn("hidden", false && "block"),
                        },
                    ]}
                />
                <div className="mt-3 font-mono text-sm">
                    <ClientOnly
                        fallback={<span className="text-faint">server / pre-hydration</span>}
                    >
                        <span className="text-success">ClientOnly children are mounted</span>
                    </ClientOnly>
                </div>
            </Spec>

            <Spec
                name="prePaintScript · consoleTabPref · createDomClassPref"
                note="Resolves <html> classes before first paint."
            >
                <pre className="overflow-x-auto rounded-lg border border-border bg-secondary p-3 font-mono text-sm">
                    <code>{prePaintScript()}</code>
                </pre>
                <Api
                    items={[
                        {
                            name: "consoleTabPref()",
                            note: "the console launcher preference it resolves by default.",
                            value: `${consoleTabPref().key} → .${consoleTabPref().className}`,
                        },
                        {
                            name: "createDomClassPref({ … })",
                            note: "the runtime half of the same idea - see ConsoleTabToggle in Console.",
                        },
                        {
                            name: "configureStorage(storage)",
                            note: "swap localStorage for a Tauri store or a server, once at boot; everything in the kit follows.",
                        },
                        {
                            name: "createTheme({ namespace })",
                            note: "an independent controller for a second app on the same origin.",
                            value: createTheme({ namespace: "gallery" }).getThemePref(),
                        },
                    ]}
                />
            </Spec>

            <Spec name="ProviderLogo" note="Provider marks; monochrome ones inherit currentColor.">
                <Row className="gap-8">
                    {PROVIDERS.map((id) => (
                        <Cell key={id} label={id}>
                            <ProviderLogo id={id} className="size-7" />
                        </Cell>
                    ))}
                </Row>
                <Note>
                    Someone else's marks, drawn to their own rules - the one place the kit is
                    allowed a literal colour, because a provider's blue is not ours to tokenise.
                </Note>
            </Spec>
        </>
    );
}
