import {
    Button,
    ClientOnly,
    ConfirmDialog,
    DEFAULT_NAMESPACE,
    Markdown,
    type ThemePref,
    ThemeToggle,
    cn,
    consoleTabPref,
    createTheme,
    getTheme,
    getThemePref,
    onThemeChange,
    prePaintScript,
    prefStorage,
    setThemePref,
    themeKey,
    toggleTheme,
} from "@paperkit/ui";
import { useEffect, useState } from "react";
import { Api, Note, Row, Spec } from "../kit";

// The pieces with no chrome of their own: the markdown renderer chat replies go through, the
// confirm wrapper, and the theme / storage / pre-paint plumbing every host wires up once.

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

/** The theme controller, read live - two toggles on one page must never disagree. */
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

export function UtilitiesSection() {
    const [killed, setKilled] = useState(false);

    return (
        <>
            <Spec
                name="ThemeToggle · theme controller"
                note="light and dark are both real product modes. The toggle flips the resolved theme and pins it."
            >
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
                name="Markdown"
                note="a dependency-free renderer for the subset models actually emit. Builds React nodes, so no HTML injection."
            >
                <Markdown
                    content={SAMPLE}
                    className="max-w-prose space-y-3 break-words text-base"
                />
            </Spec>

            <Spec
                name="ConfirmDialog"
                note="wrap any trigger to require a modal confirmation; it awaits onConfirm, then closes."
            >
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

            <Spec
                name="cn · ClientOnly"
                note="the class merger, and the render-after-hydration guard for anything that measures the DOM."
            >
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
                note="the inline <head> script that resolves persisted <html> classes before first paint, so nothing flashes."
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
        </>
    );
}
