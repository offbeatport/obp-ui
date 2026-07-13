import { Loader2, Settings2, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BuilderChoice } from "~/components/builder-choice";
import { TaskRoutingMatrix } from "~/components/task-routing-matrix";
import { Badge } from "~/components/ui/badge";
import { discoverAgents, getTaskRouting, saveConfig } from "~/server/agents";

type Discovery = Awaited<ReturnType<typeof discoverAgents>>;
type Routing = Awaited<ReturnType<typeof getTaskRouting>>;

// Shared Agents/Providers panel — the ONE source for /onboarding and /settings/agents.
// Simple: two big builder tiles (Claude/Codex). Advanced: per-task provider+model matrix.
export function AgentsProvidersPanel({
    mode = "settings",
    onReady,
}: {
    mode?: "settings" | "onboarding";
    onReady?: (d: Discovery) => void;
}) {
    const [disc, setDisc] = useState<Discovery | null>(null);
    const [routing, setRouting] = useState<Routing | null>(null);
    const [advanced, setAdvanced] = useState(false);

    const load = useCallback(async () => {
        const [d, r] = await Promise.all([discoverAgents(), getTaskRouting()]);
        setDisc(d);
        setRouting(r);
        onReady?.(d);
    }, [onReady]);

    useEffect(() => {
        void load();
    }, [load]);

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
        <div className="space-y-8">
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

                {disc.agents.length > 0 && (
                    <div className="mt-4">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                            Detected on this host
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                            {disc.agents.map((a) => (
                                <div
                                    key={a.id}
                                    className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm"
                                >
                                    <TerminalSquare className="size-4 flex-none text-faint" />
                                    <span className="flex-1 truncate font-medium">{a.name}</span>
                                    {a.installed ? (
                                        <>
                                            <span className="font-mono text-[11px] text-faint">
                                                v{a.version ?? "?"}
                                            </span>
                                            <AuthBadge state={a.authState} />
                                            {!a.drivable && (
                                                <Badge variant="neutral" className="text-[10px]">
                                                    soon
                                                </Badge>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-faint">not found</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section>
                <button
                    type="button"
                    onClick={() => setAdvanced((a) => !a)}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    <Settings2 className="size-4" />
                    Advanced — pick a model per task
                    <span className="text-faint">{advanced ? "▲" : "▼"}</span>
                </button>
                {advanced && (
                    <div className="mt-4">
                        <p className="mb-4 max-w-xl text-xs text-muted-foreground">
                            Route each thinking task to a specific provider + model (e.g. Research →
                            Perplexity, Orchestrate → Grok). Defaults route via OpenRouter. The
                            Builder above is the hands.
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

function AuthBadge({ state }: { state: "authed" | "unauthed" | "unknown" }) {
    if (state === "authed")
        return (
            <Badge variant="success" className="text-[10px]">
                logged in
            </Badge>
        );
    if (state === "unauthed")
        return (
            <Badge variant="warning" className="text-[10px]">
                not logged in
            </Badge>
        );
    return (
        <Badge variant="neutral" className="text-[10px]">
            unknown
        </Badge>
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
