import {
    CommandBar,
    FloatingDock,
    GlowTabs,
    IconPills,
    MorphDropdown,
    NumberedTicker,
    SegmentedPill,
    StatusTabs,
    TAB_SELECTORS,
    type TabSelectorDef,
    type TabSelectorProps,
    UnderlineSlide,
    VerticalRail,
    withTabIcons,
} from "obp-ui";
import { Hammer, LayoutGrid, type LucideIcon, Rocket, Settings2, TrendingUp } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Note, Spec } from "../kit";

// nav-ui - the ten page-level tab looks that are still being chosen between. All ten are
// controlled components over the same contract, so any one can drop into a real page.

const TABS = ["Overview", "Build", "Grow", "Run", "Setup"];
const BADGES: Record<string, string | number> = { Build: 3, Run: 1 };

// Label → glyph is domain data: the app owns this map, the kit only takes it.
const TAB_ICONS: Record<string, LucideIcon> = {
    Overview: LayoutGrid,
    Build: Hammer,
    Grow: TrendingUp,
    Run: Rocket,
    Setup: Settings2,
};

// The ten looks, also exported individually. Declared in registry order, so the keys line up
// with TAB_SELECTORS and each card can show the real export name.
const NAMED: Record<string, (p: TabSelectorProps) => ReactNode> = {
    UnderlineSlide,
    SegmentedPill,
    IconPills,
    CommandBar,
    VerticalRail,
    FloatingDock,
    NumberedTicker,
    GlowTabs,
    MorphDropdown,
    StatusTabs,
};

const EXPORT_NAMES = Object.keys(NAMED);
const DEFS = withTabIcons(TAB_ICONS);

function Selector({ def, name }: { def: TabSelectorDef; name: string }) {
    const [active, setActive] = useState(TABS[1]);
    const body = <def.Component tabs={TABS} active={active} onSelect={setActive} badges={BADGES} />;
    return (
        <article className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-mono text-sm font-semibold">
                    {String(def.id).padStart(2, "0")} · {name}
                </h3>
                <p className="text-sm text-muted-foreground">{def.blurb}</p>
            </div>
            {/* Several of these are wider than half a column; they scroll inside their own box
                rather than pushing the page sideways. */}
            <div
                className={
                    def.dark
                        ? "dark flex min-h-28 items-center overflow-x-auto rounded-xl border border-border bg-background p-5"
                        : "flex min-h-28 items-center overflow-x-auto rounded-xl border border-border bg-card p-5 shadow-e1"
                }
            >
                {body}
            </div>
            <p className="font-mono text-sm text-faint">active: {active}</p>
        </article>
    );
}

export function NavUiSection() {
    return (
        <>
            <Spec
                name="TAB_SELECTORS · withTabIcons"
                note="the registry of the ten looks; withTabIcons binds an icon map onto every entry (looks 3, 5, 6 and 9 use it)."
                bare
            >
                <Note>
                    {TAB_SELECTORS.length} treatments, all live below - click any of them. Tab
                    labels, badges and icons are the caller's; the gallery ships the looks.
                </Note>
            </Spec>

            <div className="grid gap-10 xl:grid-cols-2">
                {DEFS.map((def, i) => (
                    <Selector key={def.id} def={def} name={EXPORT_NAMES[i]} />
                ))}
            </div>
        </>
    );
}
