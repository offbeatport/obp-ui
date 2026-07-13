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
    // providers referenced across the model tasks → the keys they need
    const used = [
        ...new Set(MODEL_TASKS.map((t) => tasks[t]?.provider).filter(Boolean)),
    ] as string[];

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                {MODEL_TASKS.map((t) => {
                    const row = tasks[t] ?? { provider: "openrouter", model: "" };
                    const prov = PROVIDERS.find((p) => p.id === row.provider);
                    return (
                        <div
                            key={t}
                            className="grid items-center gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]"
                        >
                            <div className="min-w-0">
                                <div className="text-[13px] font-semibold">
                                    {TASK_META[t].label}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                    {TASK_META[t].purpose}
                                </div>
                            </div>
                            <Select
                                value={row.provider}
                                onValueChange={(v) => onSave(`ai.task.${t}.provider`, v)}
                            >
                                <SelectTrigger className="min-w-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDERS.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <span className="flex items-center gap-2">
                                                {p.id !== "custom" && (
                                                    <ProviderLogo
                                                        id={p.id as ProviderId}
                                                        className="size-3.5"
                                                    />
                                                )}
                                                {p.label}
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
                        Brand providers route via OpenRouter unless you add their own key — so an
                        OpenRouter key alone covers the defaults (e.g. Perplexity via OpenRouter).
                    </p>
                </div>
            )}
        </div>
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
                onBlur={(e) => onChange(e.target.value)}
            />
        );
    }
    const items = value && !models.includes(value) ? [value, ...models] : models;
    return (
        <Select value={value || models[0]} onValueChange={onChange}>
            <SelectTrigger className="min-w-0">
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
