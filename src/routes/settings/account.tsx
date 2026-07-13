import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { resetDemo } from "~/server/actions";
import { getAgentConfig, resetOnboarding, saveConfig } from "~/server/agents";

export const Route = createFileRoute("/settings/account")({
    component: Account,
});

function Account() {
    const [name, setName] = useState<string>("");
    useEffect(() => {
        void getAgentConfig().then((c) => setName(c.accountName));
    }, []);

    return (
        <div className="max-w-lg space-y-8">
            <section className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => void saveConfig({ data: { key: "account.name", value: name } })}
                />
            </section>

            <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                    Stats
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Stat v="Free" l="plan" />
                    <Stat v="$0" l="MRR" />
                    <Stat v="0" l="users" />
                </div>
            </section>

            <section className="rounded-xl border border-destructive/40 p-4">
                <div className="mb-3 text-[13px] font-semibold text-destructive">Danger zone</div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void resetOnboarding()}>
                        Reset onboarding
                    </Button>
                    <Button variant="destructive" onClick={() => void resetDemo()}>
                        Clear demo data
                    </Button>
                </div>
            </section>
        </div>
    );
}

function Stat({ v, l }: { v: string; l: string }) {
    return (
        <div className="rounded-xl border bg-card p-3">
            <div className="font-display text-xl font-semibold">{v}</div>
            <div className="text-xs text-faint">{l}</div>
        </div>
    );
}
