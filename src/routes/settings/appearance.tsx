import { createFileRoute } from "@tanstack/react-router";
import { Check, type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ConsoleTabToggle } from "~/components/console-tab-toggle";
import { getThemePref, onThemeChange, setThemePref, type ThemePref } from "~/lib/theme";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/settings/appearance")({
    component: Appearance,
});

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon; hint: string }[] = [
    { value: "light", label: "Light", icon: Sun, hint: "Always the paper theme" },
    { value: "dark", label: "Dark", icon: Moon, hint: "Always the dark theme" },
    { value: "system", label: "System", icon: Monitor, hint: "Follow your OS" },
];

function Appearance() {
    const [pref, setPref] = useState<ThemePref>("system");

    // Read the real pref after mount (SSR can't know it); keep synced with the chrome toggle.
    useEffect(() => {
        const sync = () => setPref(getThemePref());
        sync();
        return onThemeChange(sync);
    }, []);

    const pick = (v: ThemePref) => {
        setThemePref(v);
        setPref(v);
    };

    return (
        <div className="max-w-lg space-y-6">
            <section>
                <h3 className="mb-1 text-[15px] font-semibold">Theme</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                    Applied instantly and remembered on this device.
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {OPTIONS.map((o) => {
                        const active = pref === o.value;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => pick(o.value)}
                                className={cn(
                                    "relative flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left transition hover:border-primary/50",
                                    active && "border-primary ring-2 ring-primary/30",
                                )}
                            >
                                <o.icon className="size-5 text-muted-foreground" />
                                <span>
                                    <span className="block text-[13px] font-semibold">
                                        {o.label}
                                    </span>
                                    <span className="block text-[11px] text-faint">{o.hint}</span>
                                </span>
                                {active && (
                                    <Check className="absolute top-2.5 right-2.5 size-4 text-primary" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div>
                    <div className="text-[13px] font-semibold">Agent console button</div>
                    <div className="text-xs text-muted-foreground">
                        The <span className="font-mono">agents</span> tab pinned to the bottom-right.
                        Hide it to declutter — <kbd className="font-mono">Ctrl</kbd>+
                        <kbd className="font-mono">`</kbd> still opens the console.
                    </div>
                </div>
                <ConsoleTabToggle />
            </section>
        </div>
    );
}
