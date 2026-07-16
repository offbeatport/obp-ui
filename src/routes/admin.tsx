import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminTabs } from "~/components/admin-tabs";
import { AppShell } from "~/components/app-shell";

// Layout for all /admin/* pages (engine internals - not part of the founder surface).
// Children render inside <Outlet/> below the sub-tabs.
export const Route = createFileRoute("/admin")({
    component: AdminLayout,
});

function AdminLayout() {
    return (
        <AppShell active="admin">
            <div className="mx-10 my-5 max-w-4xl px-6 py-8">
                <h1 className="font-display text-3xl font-light">Admin</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Engine internals - invisible to the founder surface.
                </p>
                <AdminTabs />
                <div className="mt-6">
                    <Outlet />
                </div>
            </div>
        </AppShell>
    );
}
