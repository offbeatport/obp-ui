import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
import { LabCanvas } from "~/components/lab/canvas/lab-canvas";
import { CANVAS_VARIANTS } from "~/components/lab/canvas/variants";
import { TAB_SELECTORS, type TabSelectorDef, type TabSelectorProps } from "~/components/lab/tab-selectors";
import { TaskTimeline } from "~/components/lab/task-timeline";
import { ThemeToggle } from "~/components/theme-toggle";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/company-lab")({
    component: CompanyLab,
});

const DEMO_TABS = ["Overview", "Tasks", "Workspace", "Product", "Growth", "Setup", "Source Code"];
const DEMO_BADGES = { Overview: 1, Tasks: 3 };

const SECTIONS = ["Tab selectors", "Tasks", "Canvas"];

function CompanyLab() {
    const [section, setSection] = useState("Tab selectors");
    return (
        <AppShell active="companies">
            <div className="flex h-full min-h-0 flex-col">
                {/* header */}
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                    <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                            {"// Company page · design lab"}
                        </div>
                        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">Variations</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <SectionSwitch active={section} onSelect={setSection} />
                        <ThemeToggle />
                    </div>
                </header>

                {/* body */}
                {section === "Canvas" ? (
                    <CanvasShowcase />
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                        {section === "Tab selectors" ? <TabShowcase /> : <TaskTimeline />}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

// A tiny segmented switch for the three showcase sections.
function SectionSwitch({ active, onSelect }: { active: string; onSelect: (s: string) => void }) {
    return (
        <div className="inline-flex gap-1 rounded-full border border-border bg-secondary/70 p-1">
            {SECTIONS.map((s) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onSelect(s)}
                    className={cn(
                        "rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors",
                        s === active
                            ? "bg-card font-semibold text-foreground shadow-e1"
                            : "font-medium text-faint hover:text-foreground",
                    )}
                >
                    {s}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------- Tab showcase
function TabShowcase() {
    return (
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2">
            {TAB_SELECTORS.map((def) => (
                <TabCard key={def.id} def={def} />
            ))}
        </div>
    );
}

function TabCard({ def }: { def: TabSelectorDef }) {
    const [active, setActive] = useState(DEMO_TABS[0]);
    const props: TabSelectorProps = {
        tabs: DEMO_TABS,
        active,
        onSelect: setActive,
        badges: DEMO_BADGES,
    };
    return (
        <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-e1">
            <div className="mb-3 flex items-baseline gap-2">
                <span className="font-mono text-[11px] font-bold text-primary">{String(def.id).padStart(2, "0")}</span>
                <span className="text-[13.5px] font-semibold text-foreground">{def.name}</span>
            </div>
            <p className="mb-4 text-[12px] leading-[1.45] text-muted-foreground">{def.blurb}</p>
            <div
                className={cn(
                    "flex min-h-[92px] flex-1 items-center justify-start overflow-x-auto rounded-xl p-4",
                    def.dark ? "bg-[#0b0e1a]" : "bg-secondary/40",
                )}
            >
                <def.Component {...props} />
            </div>
            <div className="mt-2 text-center font-mono text-[10.5px] text-faint">active · {active}</div>
        </div>
    );
}

// ------------------------------------------------------------- Canvas showcase
function CanvasShowcase() {
    const [idx, setIdx] = useState(0);
    const variant = CANVAS_VARIANTS[idx];
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* variant strip */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-6 py-3">
                {CANVAS_VARIANTS.map((v, i) => (
                    <button
                        key={v.id}
                        type="button"
                        onClick={() => setIdx(i)}
                        className={cn(
                            "inline-flex flex-none items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                            i === idx
                                ? "border-primary bg-accent font-semibold text-accent-foreground"
                                : "border-border bg-card font-medium text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <span className="font-mono text-[10px] opacity-70">{String(v.id).padStart(2, "0")}</span>
                        {v.name}
                    </button>
                ))}
            </div>

            {/* blurb */}
            <div className="flex items-center gap-2 px-6 py-2.5 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-foreground">{variant.name}</span>
                <span className="text-faint">·</span>
                {variant.blurb}
                <span className="ml-auto font-mono text-[10.5px] text-faint">pan + zoom · nodes locked</span>
            </div>

            {/* the canvas - real height so React Flow can measure */}
            <div className="relative min-h-0 flex-1 border-t border-border">
                <LabCanvas variant={variant} />
            </div>
        </div>
    );
}
