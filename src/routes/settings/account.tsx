import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { resetDemo } from "~/server/actions";
import { getAgentConfig, getBootState, resetOnboarding, saveConfig } from "~/server/agents";
import { getPortfolioMetrics } from "~/server/data";

export const Route = createFileRoute("/settings/account")({
    component: Account,
});

function Account() {
    const [name, setName] = useState("");
    const [saved, setSaved] = useState(false);
    const [plan, setPlan] = useState("—");
    const [mrr, setMrr] = useState("—");
    const [users, setUsers] = useState("—");

    useEffect(() => {
        void getAgentConfig().then((c) => setName(c.accountName));
        void getBootState().then((b) =>
            setPlan(b.deployment === "hosted" ? "Hosted" : "Self-host"),
        );
        void getPortfolioMetrics().then((m) => {
            setMrr(`$${m.mrr}`);
            setUsers(String(m.users));
        });
    }, []);

    const saveName = async () => {
        await saveConfig({ data: { key: "account.name", value: name } });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className="max-w-lg space-y-8">
            <section className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={saveName}
                    />
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                            <Check className="size-3.5" /> Saved
                        </span>
                    )}
                </div>
            </section>

            <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                    Stats
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <Stat v={plan} l="plan" />
                    <Stat v={mrr} l="MRR" />
                    <Stat v={users} l="users" />
                </div>
            </section>

            <section className="rounded-xl border border-destructive/40 p-4">
                <div className="mb-1 text-[13px] font-semibold text-destructive">Danger zone</div>
                <p className="mb-3 text-xs text-muted-foreground">These can't be undone.</p>
                <div className="flex flex-wrap gap-2">
                    <ConfirmDialog
                        trigger={<Button variant="outline">Reset onboarding</Button>}
                        title="Reset onboarding?"
                        description="You'll be sent back through the first-run agent setup. Your saved config and keys are kept."
                        confirmLabel="Reset onboarding"
                        onConfirm={() => resetOnboarding()}
                    />
                    <ConfirmDialog
                        trigger={<Button variant="destructive">Clear demo data</Button>}
                        title="Clear demo data?"
                        description="Permanently deletes all companies, opportunities, actions and runs. This cannot be undone."
                        confirmLabel="Clear everything"
                        destructive
                        onConfirm={() => resetDemo()}
                    />
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
