import { createFileRoute } from "@tanstack/react-router";
import { ConsoleTabToggle } from "~/components/console-tab-toggle";
import { ThemeToggle } from "~/components/theme-toggle";

export const Route = createFileRoute("/settings/appearance")({
    component: Appearance,
});

function Appearance() {
    return (
        <div className="max-w-lg space-y-3">
            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div>
                    <div className="text-[13px] font-semibold">Theme</div>
                    <div className="text-xs text-muted-foreground">
                        Light or dark. Applied instantly and remembered on this device.
                    </div>
                </div>
                <ThemeToggle />
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div>
                    <div className="text-[13px] font-semibold">Agent console button</div>
                    <div className="text-xs text-muted-foreground">
                        The <span className="font-mono">agents</span> tab pinned to the
                        bottom-right. Hide it to declutter — <kbd className="font-mono">Ctrl</kbd>+
                        <kbd className="font-mono">`</kbd> still opens the console.
                    </div>
                </div>
                <ConsoleTabToggle />
            </section>
        </div>
    );
}
