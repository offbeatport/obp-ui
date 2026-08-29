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
import { TokensSection } from "./sections/tokens";
import { UtilitiesSection } from "./sections/utilities";

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
        blurb: "Eighteen shadcn-shaped primitives on Base UI, re-themed with obp-ui tokens, plus the colour picker shadcn does not ship. Every variant and every size the cva declares.",
        Body: PrimitivesSection,
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
        if (top) onTop(top.id);
    };
}

export function App() {
    const [active, setActive] = useState(SECTIONS[0].id);
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const [subs, setSubs] = useState<Record<string, SubNavItem[]>>({});
    const navRef = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        const found: Record<string, SubNavItem[]> = {};
        for (const s of SECTIONS) {
            const root = document.getElementById(s.id);
            if (!root) continue;
            found[s.id] = [...root.querySelectorAll<HTMLElement>("[data-spec]")].map((el) => {
                const first = (el.dataset.spec ?? "").split("·")[0].trim();
                const id = `${s.id}--${slug(first)}`;
                el.id = id;
                return { id, label: first };
            });
        }
        setSubs(found);
    }, []);

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

    useEffect(() => {
        const specs = document.querySelectorAll<HTMLElement>("[data-spec]");
        if (specs.length === 0) return;
        const io = new IntersectionObserver(bandSpy(setActiveSpec), {
            rootMargin: "-100px 0px -60% 0px",
        });
        for (const el of specs) io.observe(el);
        return () => io.disconnect();
    }, []);

    const currentSpec = activeSpec?.startsWith(`${active}--`) ? activeSpec : null;

    useEffect(() => {
        if (!currentSpec) return;
        navRef.current
            ?.querySelector(`[data-nav="${currentSpec}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [currentSpec]);

    return (
        <UIProvider>
            <div className="min-h-screen bg-background text-foreground">
                <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-secondary lg:flex">
                    <div className="px-5 pb-4 pt-6">
                        <span className="font-display text-lg font-semibold tracking-tight">
                            obp<span className="text-primary">-ui</span>
                        </span>
                    </div>
                    <nav ref={navRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
                        {SECTIONS.map((s) => (
                            <div key={s.id}>
                                <a
                                    href={`#${s.id}`}
                                    className={cn(
                                        "block px-2 pb-1 pt-5 text-sm font-bold uppercase tracking-wide",
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

                <div className="lg:pl-64">
                    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
                        <div className="mx-auto flex max-w-6xl items-center gap-4 px-8 py-4">
                            <h1 className="font-display text-xl font-light tracking-tight">
                                obp-ui
                            </h1>
                            <p className="hidden text-sm text-muted-foreground md:block">
                                every export, in both themes
                            </p>
                            <div className="ml-auto flex items-center gap-1">
                                <ThemePicker />
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
                            The law is <span className="font-mono">DESIGN.md</span> - tokens only,
                            compose don't fork, both themes work. If a component is exported and not
                            on this page, the gallery is wrong - with one deliberate exception:{" "}
                            <span className="font-mono">ThemePicker</span> is drawn in the header
                            and nowhere else, because a second live theme control on the same page
                            is a second thing claiming to be the current theme. The twelve-tile
                            preset comparison lives inside its editor. Every component also exports
                            its own <span className="font-mono">*Props</span> type next to it; those
                            are the only other exports this page does not draw.
                        </p>
                    </footer>
                </div>
            </div>
        </UIProvider>
    );
}
