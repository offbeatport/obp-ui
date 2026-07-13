import { Check } from "lucide-react";
import { ProviderLogo } from "~/components/provider-logos";
import { cn } from "~/lib/utils";

type Detected = { installed: boolean; version?: string; authState: string } | undefined;

// The simple path: two big provider tiles for the BUILD (hands) task. Claude is live/active;
// Codex is shown but disabled ("coming soon").
const OPTIONS = [
    {
        id: "claude",
        label: "Claude Code",
        logo: "anthropic",
        enabled: true,
        chip: "bg-accent text-accent-foreground",
    },
    // OpenAI brand: white mark on black chip.
    { id: "codex", label: "Codex", logo: "openai", enabled: false, chip: "bg-black text-white" },
] as const;

export function BuilderChoice({
    value,
    claude,
    onPick,
}: {
    value: string;
    claude: Detected;
    onPick: (id: string) => void;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((o) => {
                const active = value === o.id && o.enabled;
                const sub = !o.enabled
                    ? "Coming soon"
                    : claude?.installed
                      ? `detected · v${claude.version ?? "?"} · ${claude.authState}`
                      : "install & log in `claude` on this host";
                return (
                    <button
                        key={o.id}
                        type="button"
                        disabled={!o.enabled}
                        onClick={() => o.enabled && onPick(o.id)}
                        className={cn(
                            "relative flex items-center gap-3.5 rounded-2xl border bg-card p-4 text-left",
                            o.enabled ? "hover:border-primary/50" : "cursor-not-allowed opacity-55",
                            active && "border-primary ring-2 ring-primary/30",
                        )}
                    >
                        <span
                            className={cn(
                                "grid size-12 flex-none place-items-center rounded-xl",
                                o.chip,
                            )}
                        >
                            <ProviderLogo id={o.logo} className="size-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold">{o.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {sub}
                            </span>
                        </span>
                        {active && <Check className="size-5 flex-none text-primary" />}
                    </button>
                );
            })}
        </div>
    );
}
