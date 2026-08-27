import { LogoMark, PalettePicker, ThemeToggle, UIProvider, cn } from "@paperkit/ui";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { Section } from "./kit";
import { BrandSection } from "./sections/brand";
import { CanvasSection } from "./sections/canvas";
import { ChatSection } from "./sections/chat";
import { ConsoleSection } from "./sections/console";
import { DataDisplaySection } from "./sections/data-display";
import { NavSection } from "./sections/nav";
import { NavUiSection } from "./sections/nav-ui";
import { PalettesSection } from "./sections/palettes";
import { PrimitivesSection } from "./sections/primitives";
import { ShellSection } from "./sections/shell";
import { StatusSection } from "./sections/status";
import { TokensSection } from "./sections/tokens";
import { UtilitiesSection } from "./sections/utilities";

// The kitchen sink: every family in @paperkit/ui's public barrel, stacked in one page.
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
        id: "palettes",
        label: "Palettes",
        title: "Palettes",
        blurb: "The same design system in ten sets of clothes, plus a custom editor. A palette overrides token values and nothing else - no component knows it exists. Nine of the ten are built for screens you cannot calibrate: neutral paper, a deep brand solved to read as text on it, and every step darker than the authored theme.",
        Body: PalettesSection,
    },
    {
        id: "primitives",
        label: "Primitives",
        title: "Primitives",
        blurb: "Eighteen shadcn primitives re-themed with paperkit tokens, plus the colour picker shadcn does not ship. Every variant and every size the cva declares.",
        Body: PrimitivesSection,
    },
    {
        id: "brand",
        label: "Brand",
        title: "Brand",
        blurb: "The product tile, the per-entity gradient avatar and the model-provider marks.",
        Body: BrandSection,
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
        blurb: "Lists of things that happened - and the list that is empty.",
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
        blurb: "The separate @paperkit/ui/canvas entry, behind the optional @xyflow/react peer: the board, the card vocabulary, the flavors and the ten layouts.",
        Body: CanvasSection,
    },
    {
        id: "utilities",
        label: "Utilities",
        title: "Utilities & standalone",
        blurb: "The pieces with no chrome of their own: markdown, confirm, and the theme / storage / pre-paint plumbing a host wires up once.",
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

/** The topmost element still inside the reading band. */
const topmost = (entries: IntersectionObserverEntry[]) =>
    entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]?.target.id;

export function App() {
    const [active, setActive] = useState(SECTIONS[0].id);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [subs, setSubs] = useState<Record<string, SubNavItem[]>>({});

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

    // Two scroll spies, one band: which section is being read, and which Spec within it.
    useEffect(() => {
        const io = new IntersectionObserver(
            (entries) => {
                const id = topmost(entries);
                if (id) setActive(id);
            },
            { rootMargin: "-96px 0px -70% 0px" },
        );
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
        const io = new IntersectionObserver(
            (entries) => {
                const id = topmost(entries);
                if (id) setActiveSpec(id);
            },
            { rootMargin: "-100px 0px -60% 0px" },
        );
        for (const el of specs) io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <UIProvider>
            <div className="min-h-screen bg-background text-foreground">
                <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-secondary lg:flex">
                    <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
                        <LogoMark />
                        <span className="font-display text-lg font-semibold tracking-tight">
                            paperkit
                        </span>
                    </div>
                    <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
                        {SECTIONS.map((s) => {
                            const open = active === s.id;
                            return (
                                <div key={s.id}>
                                    <a
                                        href={`#${s.id}`}
                                        className={cn(
                                            "block rounded-md px-3 py-2 text-sm font-semibold",
                                            open
                                                ? "bg-card text-foreground"
                                                : "text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground",
                                        )}
                                    >
                                        {s.label}
                                    </a>
                                    {/* Only the section being read expands - twelve sections'
                                        worth of Specs at once is a wall, not navigation. */}
                                    {open && subs[s.id]?.length > 0 && (
                                        <div className="mt-0.5 mb-1 ml-3 border-l border-border pl-2">
                                            {subs[s.id].map((sub) => (
                                                <a
                                                    key={sub.id}
                                                    href={`#${sub.id}`}
                                                    className={cn(
                                                        "block truncate rounded-md px-2.5 py-1 text-sm",
                                                        activeSpec === sub.id
                                                            ? "font-medium text-primary"
                                                            : "text-muted-foreground hover:text-foreground",
                                                    )}
                                                >
                                                    {sub.label}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    <div className="border-t border-border px-5 py-4 font-mono text-sm text-faint">
                        pnpm ui
                    </div>
                </aside>

                <div className="lg:pl-64">
                    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
                        <div className="mx-auto flex max-w-6xl items-center gap-4 px-8 py-4">
                            <h1 className="font-display text-xl font-light tracking-tight">
                                @paperkit/ui
                            </h1>
                            <p className="hidden text-sm text-muted-foreground md:block">
                                every export, in both themes
                            </p>
                            <div className="ml-auto flex items-center gap-1">
                                <PalettePicker />
                                <ThemeToggle />
                            </div>
                        </div>
                    </header>

                    <main className="mx-auto max-w-6xl space-y-24 px-8 py-12">
                        {SECTIONS.map((s) => (
                            <Section key={s.id} id={s.id} title={s.title} blurb={s.blurb}>
                                <s.Body />
                            </Section>
                        ))}
                    </main>

                    <footer className="mx-auto max-w-6xl px-8 pb-16 pt-4">
                        <p className="border-t border-border-soft pt-6 text-sm text-muted-foreground">
                            The law is <span className="font-mono">packages/ui/DESIGN.md</span> -
                            tokens only, compose don't fork, both themes work. If a component is
                            exported and not on this page, the gallery is wrong. Every component
                            also exports its own <span className="font-mono">*Props</span> type next
                            to it; those are the only exports this page does not draw.
                        </p>
                    </footer>
                </div>
            </div>
        </UIProvider>
    );
}
