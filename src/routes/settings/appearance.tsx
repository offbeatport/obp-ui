import { createFileRoute } from "@tanstack/react-router";
import { ThemeToggle } from "~/components/theme-toggle";

export const Route = createFileRoute("/settings/appearance")({
    component: Appearance,
});

function Appearance() {
    return (
        <div className="max-w-lg">
            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div>
                    <div className="text-[13px] font-semibold">Theme</div>
                    <div className="text-xs text-muted-foreground">
                        Light or dark. Applied instantly and remembered on this device.
                    </div>
                </div>
                <ThemeToggle />
            </section>
        </div>
    );
}
