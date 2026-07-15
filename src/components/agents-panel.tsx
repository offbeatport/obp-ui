import { Check, Loader2, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BuilderChoice } from "~/components/builder-choice";
import { ProviderLogo } from "~/components/provider-logos";
import { TaskRoutingMatrix } from "~/components/task-routing-matrix";
import { Input } from "~/components/ui/input";
import { discoverAgents, getTaskRouting, saveConfig } from "~/server/agents";

type Discovery = Awaited<ReturnType<typeof discoverAgents>>;
type Routing = Awaited<ReturnType<typeof getTaskRouting>>;

// Shared Agents/Providers panel - the ONE source for /onboarding and /settings/agents.
// Simple: two big builder tiles (Claude/Codex). Advanced: per-task provider+model matrix.
// Readiness the onboarding gate needs: is there a usable AI config yet?
export type PanelReady = { claudeReady: boolean; canFinish: boolean };

export function AgentsProvidersPanel({
    mode = "settings",
    onReady,
}: {
    mode?: "settings" | "onboarding";
    onReady?: (r: PanelReady) => void;
}) {
    const [disc, setDisc] = useState<Discovery | null>(null);
    const [routing, setRouting] = useState<Routing | null>(null);
    const [advanced, setAdvanced] = useState(false);

    const load = useCallback(async () => {
        const [d, r] = await Promise.all([discoverAgents(), getTaskRouting()]);
        setDisc(d);
        setRouting(r);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Re-emit readiness on every disc/routing change (initial load, key added, builder picked).
    useEffect(() => {
        if (!disc || !routing || !onReady) return;
        const c = disc.agents.find((a) => a.id === "claude");
        const claudeReady = !!c?.installed && c.authState === "authed";
        const hasKey = !!routing.keys.openrouter;
        const managed = disc.deployment === "hosted" && disc.managedAvailable;
        onReady({ claudeReady, canFinish: claudeReady || hasKey || managed });
    }, [disc, routing, onReady]);

    const save = useCallback(async (key: string, value: unknown, secret = false) => {
        await saveConfig({ data: { key, value, secret } });
        setRouting(await getTaskRouting());
    }, []);

    const pickBuilder = useCallback(async (id: string) => {
        await Promise.all([
            saveConfig({ data: { key: "ai.simple", value: id } }),
            saveConfig({ data: { key: "ai.task.build.provider", value: id } }),
        ]);
        setRouting(await getTaskRouting());
    }, []);

    if (!disc || !routing) {
        return (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Discovering agents…
            </div>
        );
    }

    const claude = disc.agents.find((a) => a.id === "claude");

    return (
        <div className="space-y-12">
            <section>
                <SectionHead
                    title="Builder"
                    hint="The coding agent that writes & ships your code. Only Claude is drivable in v1."
                />
                <BuilderChoice
                    value={routing.builder}
                    claude={
                        claude
                            ? {
                                  installed: claude.installed,
                                  version: claude.version,
                                  authState: claude.authState,
                              }
                            : undefined
                    }
                    onPick={pickBuilder}
                />
            </section>

            <section>
                <SectionHead
                    title="Thinking"
                    hint="Planning, research & scoring run on your Claude subscription by default - no key needed. Add an OpenRouter key to use cheaper models and live web research (Perplexity)."
                />
                <OpenRouterKeyField last4={routing.keys.openrouter} onSave={save} />
            </section>

            <section>
                <button
                    type="button"
                    onClick={() => setAdvanced((a) => !a)}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    <Settings2 className="size-4" />
                    Advanced - pick a model per task
                    <span className="text-faint">{advanced ? "▲" : "▼"}</span>
                </button>
                {advanced && (
                    <div className="mt-4">
                        <p className="mb-4 max-w-xl text-xs text-muted-foreground">
                            Route each thinking task to a specific provider + model (e.g. Research →
                            Perplexity, Orchestrate → Grok). Tasks default to Claude, or to
                            OpenRouter once you add a key above. The Builder is the hands.
                        </p>
                        <TaskRoutingMatrix
                            tasks={routing.tasks}
                            keys={routing.keys}
                            onSave={save}
                        />
                    </div>
                )}
            </section>
        </div>
    );
}

// Optional OpenRouter key. Its PRESENCE flips thinking tasks from the Claude subscription to
// OpenRouter routing - no separate toggle needed.
function OpenRouterKeyField({
    last4,
    onSave,
}: {
    last4: string | null;
    onSave: (key: string, value: unknown, secret?: boolean) => void;
}) {
    const [saved, setSaved] = useState(false);
    return (
        <div className="flex items-center gap-2.5 rounded-xl border bg-card p-3">
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent text-accent-foreground">
                <ProviderLogo id="openrouter" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">OpenRouter key (optional)</div>
                <div className="text-xs text-muted-foreground">
                    {last4 ? `Active · •••• ${last4}` : "sk-or-…  - leave blank to stay on Claude"}
                </div>
            </div>
            <Input
                type="password"
                placeholder={last4 ? "replace key" : "sk-or-…"}
                className="max-w-[220px]"
                onBlur={(e) => {
                    if (!e.target.value) return;
                    onSave("ai.key.openrouter", e.target.value, true);
                    setSaved(true);
                }}
            />
            {saved && <Check className="size-4 flex-none text-primary" />}
        </div>
    );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="mb-3">
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}
