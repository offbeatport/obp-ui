import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/runs")({
    component: Runs,
});

function Runs() {
    return (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Runs explorer — coming soon.
        </div>
    );
}
