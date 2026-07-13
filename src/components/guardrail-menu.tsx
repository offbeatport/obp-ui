import { Check, type LucideIcon, ShieldCheck, SlidersHorizontal, Sprout, Zap } from "lucide-react";
import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

// The composer's guardrail-preset selector (prototype .spin-hero-guard): the founder picks how
// aggressive/safe the agent should be before it spins up a company.
type Preset = { key: string; icon: LucideIcon; name: string; desc: string; rec?: boolean };

const PRESETS: Preset[] = [
    {
        key: "lean",
        icon: ShieldCheck,
        name: "Lean & safe",
        desc: "≤ $500/mo · test-mode · avoid regulated",
        rec: true,
    },
    {
        key: "fast",
        icon: Zap,
        name: "Move fast",
        desc: "≤ $2k/mo · charge day one · ship in a week",
    },
    { key: "boot", icon: Sprout, name: "Bootstrap", desc: "$0 spend · free for now · no deadline" },
    {
        key: "custom",
        icon: SlidersHorizontal,
        name: "Custom…",
        desc: "Set each guardrail yourself",
    },
];

export function GuardrailMenu() {
    const [sel, setSel] = useState("lean");
    const current = PRESETS.find((p) => p.key === sel) ?? PRESETS[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold hover:bg-secondary"
                >
                    <ShieldCheck className="size-4 text-primary" />
                    {current.name}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
                {PRESETS.map((p) => {
                    const Icon = p.icon;
                    return (
                        <DropdownMenuItem
                            key={p.key}
                            onSelect={() => setSel(p.key)}
                            className="items-start gap-3 py-2.5"
                        >
                            <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-md bg-accent text-accent-foreground">
                                <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 text-[13px] font-semibold">
                                    {p.name}
                                    {p.rec && (
                                        <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                            Recommended
                                        </span>
                                    )}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {p.desc}
                                </span>
                            </span>
                            {sel === p.key && (
                                <Check className="mt-1 size-4 flex-none text-primary" />
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
