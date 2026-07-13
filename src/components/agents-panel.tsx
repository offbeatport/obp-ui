import { Check, Loader2, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { discoverAgents, getAgentConfig, saveConfig, testBrainConnection } from "~/server/agents";

type Discovery = Awaited<ReturnType<typeof discoverAgents>>;
type Cfg = Awaited<ReturnType<typeof getAgentConfig>>;

const BRAIN_PROVIDERS = [
    { value: "openrouter", label: "OpenRouter (model-agnostic)" },
    { value: "anthropic", label: "Anthropic" },
    { value: "openai", label: "OpenAI" },
    { value: "zai", label: "z.ai (GLM)" },
    { value: "custom", label: "Custom…" },
];

function secretKeyFor(provider: string): string {
    if (provider === "anthropic") return "agent.anthropic_api_key";
    if (provider === "openrouter") return "agent.openrouter_api_key";
    return "agent.brain_api_key";
}

export function AgentsProvidersPanel({
    mode = "settings",
    onReady,
}: {
    mode?: "settings" | "onboarding";
    onReady?: (d: Discovery) => void;
}) {
    const [disc, setDisc] = useState<Discovery | null>(null);
    const [cfg, setCfg] = useState<Cfg | null>(null);
    const [keyInput, setKeyInput] = useState("");
    const [saved, setSaved] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [testMsg, setTestMsg] = useState<{ ok: boolean; detail: string } | null>(null);

    const flash = useCallback((k: string) => {
        setSaved(k);
        setTimeout(() => setSaved((s) => (s === k ? null : s)), 1500);
    }, []);

    useEffect(() => {
        void (async () => {
            const [d, c] = await Promise.all([discoverAgents(), getAgentConfig()]);
            setDisc(d);
            setCfg(c);
            onReady?.(d);
        })();
    }, [onReady]);

    const save = useCallback(
        async (key: string, value: unknown, secret = false) => {
            await saveConfig({ data: { key, value, secret } });
            setCfg((c) => (c ? { ...c, [dbKeyToField(key)]: value } : c));
            flash(key);
        },
        [flash],
    );

    if (!disc || !cfg) {
        return (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Discovering agents…
            </div>
        );
    }

    const claude = disc.agents.find((a) => a.id === "claude");
    const claudeReady = !!claude?.installed && claude.drivable;

    return (
        <div className="space-y-8">
            {/* HANDS — which coding agent builds */}
            <section>
                <SectionHead
                    title="Builder (hands)"
                    hint="The coding agent that writes + ships code. v1 drives Claude Code; more coming."
                />
                <RadioGroup
                    value={cfg.harness}
                    onValueChange={(v) => save("agent.harness", v)}
                    className="gap-2"
                >
                    <RadioRow
                        value="claude"
                        disabled={!claudeReady}
                        label="Claude Code"
                        sub={
                            claude?.installed
                                ? `detected · v${claude.version ?? "?"} · ${claude.authState}`
                                : "not installed — run `claude` login on this host"
                        }
                    />
                    <RadioRow
                        value="noop"
                        label="None (no-op)"
                        sub="Runs the control plane with zero setup — no real builds."
                    />
                </RadioGroup>

                <div className="mt-4 ">
                    <div className="mb-2 font-semibold uppercase tracking-[0.08em] text-faint">
                        Detected on this host
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                        {disc.agents.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
                            >
                                <div className={cn(!a.drivable && "opacity-30")}>
                                    <TerminalSquare className="size-4 flex-none text-faint" />
                                    <span className="flex-1 font-medium">{a.name}</span>
                                    {a.installed ? (
                                        <>
                                            <span className="font-mono text-faint">
                                                v{a.version ?? "?"}
                                            </span>
                                            <AuthBadge state={a.authState} />
                                        </>
                                    ) : (
                                        <span className="text-xs text-faint">not found</span>
                                    )}
                                </div>
                                {!a.drivable && (
                                    <Badge
                                        variant="neutral"
                                        className="text-xs absolute text-accent"
                                    >
                                        driver coming
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BRAIN — the thinking model (scoring/planning/drafting) */}
            <section>
                <SectionHead
                    title="Brain (thinking)"
                    hint={
                        disc.deployment === "hosted"
                            ? "CSlopSlop credits via OpenRouter — managed & metered."
                            : "Model behind the work — OpenRouter by default (BYOK). Or CSlopSlop credits."
                    }
                />
                <div className="grid max-w-md gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="brainProvider">Provider</Label>
                        <Select
                            value={cfg.brainProvider}
                            onValueChange={(v) => save("agent.brain_provider", v)}
                        >
                            <SelectTrigger id="brainProvider">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BRAIN_PROVIDERS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="brainModel">Model</Label>
                        <Input
                            id="brainModel"
                            defaultValue={cfg.brainModel}
                            placeholder="anthropic/claude-3.7-sonnet · z-ai/glm-4.6 · …"
                            onBlur={(e) => save("agent.brain_model", e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="brainKey">
                            {disc.deployment === "hosted" ? "Managed" : "API key (BYOK)"}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="brainKey"
                                type="password"
                                value={keyInput}
                                placeholder={
                                    cfg.openrouterKeyLast4 || cfg.anthropicKeyLast4
                                        ? `•••• ${cfg.openrouterKeyLast4 ?? cfg.anthropicKeyLast4}`
                                        : "sk-…"
                                }
                                onChange={(e) => setKeyInput(e.target.value)}
                                onBlur={() =>
                                    keyInput &&
                                    save(secretKeyFor(cfg.brainProvider), keyInput, true)
                                }
                            />
                            <Button
                                variant="outline"
                                disabled={testing || !keyInput}
                                onClick={async () => {
                                    setTesting(true);
                                    setTestMsg(null);
                                    const r = await testBrainConnection({
                                        data: { provider: cfg.brainProvider, key: keyInput },
                                    });
                                    setTestMsg(r);
                                    setTesting(false);
                                }}
                            >
                                {testing ? <Loader2 className="animate-spin" /> : "Test"}
                            </Button>
                        </div>
                        {testMsg && (
                            <span
                                className={`text-xs ${testMsg.ok ? "text-success" : "text-destructive"}`}
                            >
                                {testMsg.ok ? "✓ " : "✗ "}
                                {testMsg.detail}
                            </span>
                        )}
                    </div>
                    <div>
                        <Badge variant={cfg.credMode === "apikey" ? "info" : "neutral"}>
                            {cfg.credMode === "apikey" ? "metered (API key)" : "subscription"}
                        </Badge>
                    </div>
                </div>
            </section>

            {mode === "settings" && saved && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" /> Saved
                </span>
            )}
        </div>
    );
}

function dbKeyToField(key: string): string {
    return (
        {
            "agent.harness": "harness",
            "agent.brain_provider": "brainProvider",
            "agent.brain_model": "brainModel",
        }[key] ?? key
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

function RadioRow({
    value,
    label,
    sub,
    disabled,
}: { value: string; label: string; sub: string; disabled?: boolean }) {
    return (
        <Label
            htmlFor={`h-${value}`}
            className={`flex items-start gap-3 rounded-xl border bg-card p-3 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-primary/[0.04]"}`}
        >
            <RadioGroupItem
                id={`h-${value}`}
                value={value}
                disabled={disabled}
                className="mt-0.5"
            />
            <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
            </span>
        </Label>
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
