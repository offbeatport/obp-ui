import { ThemePicker, ThemeToggle, UIProvider, cn } from "obp-ui";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Section } from "./kit";
import { CanvasSection } from "./sections/canvas";
import { ChatSection } from "./sections/chat";
import { ConsoleSection } from "./sections/console";
import { DataDisplaySection } from "./sections/data-display";
import { NavSection } from "./sections/nav";
import { NavUiSection } from "./sections/nav-ui";
import { PrimitivesSection } from "./sections/primitives";
import { ShellSection } from "./sections/shell";
import { StatusSection } from "./sections/status";
import { TokensSection } from "./sections/tokens";
import { UtilitiesSection } from "./sections/utilities";
import { Showcase } from "./showcase";

// The kitchen sink: every family in obp-ui's public barrel, stacked in one page.
//
// The whole tree is wrapped in <UIProvider> with NO Link supplied, so nav components degrade
// to plain <a href> and the gallery needs no router. That degradation is a documented part of
// the seam, not a shortcut.

type SectionDef = {
    id: string;
    label: string;
    title: string;
    blurb: string;
    Body: () => ReactNode;
};

const SECTIONS: SectionDef[] = [
    {
        id: "tokens",
        label: "Tokens",
        title: "Tokens",
        blurb: "Surfaces, brand, the status language and its -soft fills, radius, elevation, type. Everything else is built from these - branding a product means overriding these values and nothing else.",
        Body: TokensSection,
    },
    {
        id: "primitives",
        label: "Primitives",
        title: "Primitives",
        blurb: "Eighteen shadcn primitives re-themed with obp-ui tokens, plus the colour picker shadcn does not ship. Every variant and every size the cva declares.",
        Body: PrimitivesSection,
    },
    {
        id: "status",
        label: "Status",
        title: "Status",
        blurb: "The small atoms that express state. They ship the shape; the tone → colour decision stays with the app.",
        Body: StatusSection,
    },
    {
        id: "data-display",
        label: "Data display",
        title: "Data display",
        blurb: "Lists of things that happened, the list that is empty, and the avatar that heads a row.",
        Body: DataDisplaySection,
    },
    {
        id: "nav",
        label: "Navigation",
        title: "Navigation",
        blurb: "The router-agnostic nav seam, and the two tab bars the app actually routes through.",
        Body: NavSection,
    },
    {
        id: "nav-ui",
        label: "Tab selectors",
        title: "Tab selectors",
        blurb: "nav-ui: ten page-level tab looks that are still being chosen between. All ten are live - click them.",
        Body: NavUiSection,
    },
    {
        id: "chat",
        label: "Chat",
        title: "Chat",
        blurb: "The conversation surfaces: the docked co-pilot panel and the full-page thread, from one component per family.",
        Body: ChatSection,
    },
    {
        id: "console",
        label: "Console",
        title: "Console",
        blurb: "The bottom-docked live agent console and the log surfaces it shares with the rest of the app.",
        Body: ConsoleSection,
    },
    {
        id: "shell",
        label: "Shell",
        title: "Shell",
        blurb: "The application frame, rendered inside a fixed box so it makes sense on a page that is not an app.",
        Body: ShellSection,
    },
    {
        id: "canvas",
        label: "Canvas",
        title: "Canvas",
        blurb: "The separate obp-ui/canvas entry, behind the optional @xyflow/react peer: the board, the card vocabulary, the flavors and the ten layouts.",
        Body: CanvasSection,
    },
    {
        id: "utilities",
        label: "Utilities",
        title: "Utilities & standalone",
        blurb: "The pieces with no chrome of their own: markdown, confirm, and the plumbing a host wires up once - light/dark, the four-axis theme presets, storage, pre-paint. Theme CONFIGURATION is not a section here: it is the control in the page header, which is the only place it can be exercised honestly.",
        Body: UtilitiesSection,
    },
];

type SubNavItem = { id: string; label: string };

const slug = (s: string) =>
    s
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

/**
 * An IntersectionObserver callback that reports the topmost element still inside the reading
 * band, and keeps reporting it.
 *
 * The naive version - filter this batch for `isIntersecting`, take the topmost - is wrong, and
 * the flat sidebar is what made it visible. IO delivers only what CHANGED, so scrolling out of
 * a dense section hands you a batch of pure exits: nothing is intersecting *in the batch*, the
 * spy declines to update, and the highlight stays on a Spec you left two sections ago. Measured
 * at 55% down the page: the item said "StatusDot" while the section label said "Tab selectors" -
 * two highlights, in different places, both claiming to be where you are.
 *
 * So keep the live set of what is in the band and pick from that. The sort only touches the
 * handful currently intersecting, and only when something enters or leaves - not per frame.
 */
function bandSpy(onTop: (id: string) => void) {
    const inBand = new Set<string>();
    return (entries: IntersectionObserverEntry[]) => {
        for (const e of entries) {
            if (e.isIntersecting) inBand.add(e.target.id);
            else inBand.delete(e.target.id);
        }
        const top = [...inBand]
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null)
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        // Empty band (between two sections, or the page is hidden) keeps the last answer, which
        // is the honest one: you have not arrived anywhere else yet.
        if (top) onTop(top.id);
    };
}

/**
 * Two pages, one app, no router.
 *
 * The gallery is the exhaustive inventory - every export, one block per family, the thing you
 * check after a change. The showcase is the same system laid out as a designed page, which is a
 * different question: a kit can render every export correctly and still look wrong composed.
 *
 * Deliberately a state switch rather than a route. The whole app runs under a <UIProvider> with
 * no Link supplied, so nav components degrade to plain <a href> - that degradation is part of the
 * seam's contract and the gallery is where it gets exercised. Adding a router here would retire
 * the only place that is tested.
 */
type Page = "gallery" | "showcase";

/**
 * THE SHOWCASE IS THE FRONT DOOR - `pnpm dev` opens on it.
 *
 * Not because it shows more. It shows strictly less: its nine sections (Color, Typography,
 * Buttons, Status chips, Forms, Cards, Tabs, Overlays, Table) are a CONTENT SUBSET of the
 * gallery - every one of them is covered by a Spec below. A subset does not earn being a peer.
 *
 * What it has that the gallery cannot have is that it reads as a DESIGNED PAGE rather than a
 * catalogue, and that is the first thing anyone opening this repo needs to see: what the system
 * looks like when it is actually composed. So one page has a purpose and the other has a job -
 * arrive at the purpose, switch to the job. The header switch is unchanged; the gallery is one
 * click away and stays mounted (hidden, not unmounted) so its scroll spies never re-initialise.
 */
const DEFAULT_PAGE: Page = "showcase";

export function App() {
    const [page, setPage] = useState<Page>(DEFAULT_PAGE);
    const [active, setActive] = useState(SECTIONS[0].id);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [subs, setSubs] = useState<Record<string, SubNavItem[]>>({});
    const navRef = useRef<HTMLElement>(null);

    // The sub-navigation is READ OFF THE PAGE, not declared next to it. Every <Spec> stamps its
    // own name; this assigns each one an anchor id namespaced by the section it landed in and
    // collects the result. Add a Spec anywhere and it appears in the sidebar with no second
    // edit - and a list that cannot drift is worth the one DOM pass.
    useLayoutEffect(() => {
        const found: Record<string, SubNavItem[]> = {};
        for (const s of SECTIONS) {
            const root = document.getElementById(s.id);
            if (!root) continue;
            found[s.id] = [...root.querySelectorAll<HTMLElement>("[data-spec]")].map((el) => {
                // "Input · Textarea · Label" navs as "Input" - the rest is in the heading.
                const first = (el.dataset.spec ?? "").split("·")[0].trim();
                const id = `${s.id}--${slug(first)}`;
                el.id = id;
                return { id, label: first };
            });
        }
        setSubs(found);
    }, []);

    // Two scroll spies, one band: which section is being read, and which Spec within it. With a
    // flat sidebar both answers are on screen at once, so they have to agree - see bandSpy.
    useEffect(() => {
        const io = new IntersectionObserver(bandSpy(setActive), {
            rootMargin: "-96px 0px -70% 0px",
        });
        for (const s of SECTIONS) {
            const el = document.getElementById(s.id);
            if (el) io.observe(el);
        }
        return () => io.disconnect();
    }, []);

    // Safe to run once: the layout effect above has already stamped every id by the time a
    // passive effect fires, so `target.id` is never the empty string here.
    useEffect(() => {
        const specs = document.querySelectorAll<HTMLElement>("[data-spec]");
        if (specs.length === 0) return;
        const io = new IntersectionObserver(bandSpy(setActiveSpec), {
            rootMargin: "-100px 0px -60% 0px",
        });
        for (const el of specs) io.observe(el);
        return () => io.disconnect();
    }, []);

    // THE ITEM HIGHLIGHT IS SUBORDINATE TO THE SECTION HIGHLIGHT. Not every inch of the page is
    // inside a <Spec> - Tab selectors puts its ten live treatments in a plain grid *after* its
    // one Spec, ~1500px with nothing stamped - so scrolling through them leaves the Spec spy
    // holding an id from the section before. On the old accordion that was invisible (the stale
    // item was inside a collapsed section); on a flat list it would draw two highlights, in two
    // different sections, both claiming to be where you are. The section wins and the item goes
    // quiet, which is also the truth: there is no Spec here.
    const currentSpec = activeSpec?.startsWith(`${active}--`) ? activeSpec : null;

    // A flat list of ~60 items is taller than the rail, so the highlight can be scrolled out of
    // sight - which is the one way a scroll spy makes things worse than no spy at all. Follow it.
    // `block: "nearest"` scrolls the nav and nothing else: the nav is `fixed`, so it is always
    // inside the window's viewport and the window itself has no reason to move.
    useEffect(() => {
        if (!currentSpec) return;
        navRef.current
            ?.querySelector(`[data-nav="${currentSpec}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [currentSpec]);

    return (
        <UIProvider>
            <div className="min-h-screen bg-background text-foreground">
                {page === "gallery" && (
                    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-secondary lg:flex">
                        {/* The gallery's own identity, and only the gallery's: a wordmark, not a
                            tile. A mark here would have to be *some product's* mark, which is the
                            whole reason the Brand family left the kit. Type and one token do it. */}
                        <div className="px-5 pb-4 pt-6">
                            <span className="font-display text-lg font-semibold tracking-tight">
                                obp<span className="text-primary">-ui</span>
                            </span>
                        </div>
                        {/* FLAT, and expanded at all times. An accordion that opens the section
                            you are already reading tells you what you know and hides what you
                            are looking for: the item you want is almost always in a section you
                            have not reached yet, so every jump used to cost a click to open plus
                            a click to go. A long list is the cheaper failure - it scrolls, and
                            the scroll spy keeps your place in it.

                            Styling follows the rail's own house pattern (shell/section-label.tsx
                            and shell/nav-item.tsx): labels are the small bold uppercase faint
                            heading, items carry NavItem's `bg-card` active fill and its
                            `bg-primary/[0.1]` hover. */}
                        <nav ref={navRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
                            {SECTIONS.map((s) => (
                                <div key={s.id}>
                                    <a
                                        href={`#${s.id}`}
                                        className={cn(
                                            "block px-2 pb-1 pt-5 text-sm font-bold uppercase tracking-wide",
                                            // The section spy no longer opens anything; it still
                                            // answers "where am I" at a glance in a 60-item list.
                                            active === s.id ? "text-foreground" : "text-faint/70",
                                        )}
                                    >
                                        {s.label}
                                    </a>
                                    {subs[s.id]?.map((sub) => (
                                        <a
                                            key={sub.id}
                                            href={`#${sub.id}`}
                                            data-nav={sub.id}
                                            className={cn(
                                                "block truncate rounded-sm px-2 py-1.5 text-sm font-semibold",
                                                currentSpec === sub.id
                                                    ? "bg-card text-foreground"
                                                    : "text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground",
                                            )}
                                        >
                                            {sub.label}
                                        </a>
                                    ))}
                                </div>
                            ))}
                        </nav>
                        <div className="border-t border-border px-5 py-4 font-mono text-sm text-faint">
                            pnpm dev
                        </div>
                    </aside>
                )}

                <div className={page === "gallery" ? "lg:pl-64" : ""}>
                    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
                        <div className="mx-auto flex max-w-6xl items-center gap-4 px-8 py-4">
                            <h1 className="font-display text-xl font-light tracking-tight">
                                obp-ui
                            </h1>
                            <div className="flex rounded-md border border-border p-0.5">
                                {(["gallery", "showcase"] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            "rounded px-3 py-1 text-sm font-medium capitalize",
                                            page === p
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <p className="hidden text-sm text-muted-foreground md:block">
                                {page === "gallery"
                                    ? "every export, in both themes"
                                    : "the system, laid out"}
                            </p>
                            <div className="ml-auto flex items-center gap-1">
                                <ThemePicker />
                                <ThemeToggle />
                            </div>
                        </div>
                    </header>

                    {page === "showcase" && <Showcase />}

                    <main
                        className={cn(
                            "mx-auto max-w-6xl space-y-24 px-8 py-12",
                            page !== "gallery" && "hidden",
                        )}
                    >
                        {SECTIONS.map((s) => (
                            <Section key={s.id} id={s.id} title={s.title} blurb={s.blurb}>
                                <s.Body />
                            </Section>
                        ))}
                    </main>

                    {/* The gallery's footer states the gallery's law, so it hangs off the
                        gallery. The showcase closes itself. */}
                    {page === "gallery" && (
                        <footer className="mx-auto max-w-6xl px-8 pb-16 pt-4">
                            <p className="border-t border-border-soft pt-6 text-sm text-muted-foreground">
                                The law is <span className="font-mono">DESIGN.md</span> - tokens
                                only, compose don't fork, both themes work. If a component is
                                exported and not on this page, the gallery is wrong - with one
                                deliberate exception: <span className="font-mono">ThemePicker</span>{" "}
                                is drawn in the header and nowhere else, because a second live theme
                                control on the same page is a second thing claiming to be the
                                current theme. The twelve-tile preset comparison lives inside its
                                editor. Every component also exports its own{" "}
                                <span className="font-mono">*Props</span> type next to it; those are
                                the only other exports this page does not draw.
                            </p>
                        </footer>
                    )}
                </div>
            </div>
        </UIProvider>
    );
}
