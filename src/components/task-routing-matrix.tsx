import { Info } from "lucide-react";
import { type ProviderId, ProviderLogo } from "~/components/provider-logos";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { MODEL_TASKS, PROVIDERS, TASK_META } from "~/config/ai-catalog";

type Row = { provider: string; model: string; via?: string };
type Routing = Record<string, Row>;

export function TaskRoutingMatrix({
    tasks,
    keys,
    onSave,
}: {
    tasks: Routing;
    keys: Record<string, string | null>;
    onSave: (key: string, value: unknown, secret?: boolean) => void;
}) {
    // providers referenced across the model tasks → the keys they need. claude (subscription)
    // needs no key, so it never shows a key field.
    const used = (
        [...new Set(MODEL_TASKS.map((t) => tasks[t]?.provider).filter(Boolean))] as string[]
    ).filter((p) => p !== "claude");

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="space-y-2">
                    {MODEL_TASKS.map((t) => {
                        const row = tasks[t] ?? { provider: "openrouter", model: "" };
                        const prov = PROVIDERS.find((p) => p.id === row.provider);
                        return (
                            <div key={t} className="rounded-xl border bg-card p-3.5">
                                <div className="mb-3 min-w-0">
                                    <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                                        {TASK_META[t].label}
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`What is ${TASK_META[t].label}?`}
                                                    className="text-faint hover:text-foreground"
                                                >
                                                    <Info className="size-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-56">
                                                {TASK_META[t].purpose}
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {TASK_META[t].purpose}
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Select
                                        value={row.provider}
                                        onValueChange={(v) => onSave(`ai.task.${t}.provider`, v)}
                                    >
                                        <SelectTrigger className="w-full min-w-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PROVIDERS.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        {p.id !== "custom" && (
                                                            <ProviderLogo
                                                                id={(p.logo ?? p.id) as ProviderId}
                                                                className="size-3.5 flex-none"
                                                            />
                                                        )}
                                                        <span className="truncate">{p.label}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <ModelControl
                                        models={prov?.models ?? []}
                                        value={row.model}
                                        onChange={(v) => onSave(`ai.task.${t}.model`, v)}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {used.length > 0 && (
                    <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                            Provider keys
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {used.map((p) => (
                                <div key={p} className="grid gap-1.5">
                                    <Label htmlFor={`k-${p}`} className="text-xs">
                                        {PROVIDERS.find((x) => x.id === p)?.label ?? p}
                                    </Label>
                                    <Input
                                        id={`k-${p}`}
                                        type="password"
                                        placeholder={keys[p] ? `•••• ${keys[p]}` : "sk-…"}
                                        onBlur={(e) =>
                                            e.target.value &&
                                            onSave(`ai.key.${p}`, e.target.value, true)
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Brand providers route via OpenRouter unless you add their own key - so
                            an OpenRouter key alone covers the defaults (e.g. Perplexity via
                            OpenRouter).
                        </p>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}

// Preset models when the provider has them (current value added if missing); free input otherwise.
function ModelControl({
    models,
    value,
    onChange,
}: {
    models: string[];
    value: string;
    onChange: (v: string) => void;
}) {
    if (models.length === 0) {
        return (
            <Input
                defaultValue={value}
                placeholder="model slug"
                className="w-full"
                onBlur={(e) => onChange(e.target.value)}
            />
        );
    }
    // A legacy value may carry an OpenRouter "vendor/model" prefix; if the bare tail matches a
    // preset for this (direct) provider, show the bare form instead of a stray prefixed entry.
    const bare = value.includes("/") ? value.slice(value.indexOf("/") + 1) : value;
    const current = models.includes(bare) ? bare : value;
    const items = current && !models.includes(current) ? [current, ...models] : models;
    return (
        <Select value={current || models[0]} onValueChange={onChange}>
            <SelectTrigger className="w-full min-w-0">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {items.map((m) => (
                    <SelectItem key={m} value={m}>
                        <span className="truncate font-mono text-xs">{m}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
