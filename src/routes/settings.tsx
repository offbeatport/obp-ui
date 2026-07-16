import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { SettingsTabs } from "~/components/settings-tabs";

// Layout for /settings/* - shell + sub-tabs + <Outlet/>. Reached via the rail user menu.
export const Route = createFileRoute("/settings")({
    component: SettingsLayout,
});

function SettingsLayout() {
    return (
        <AppShell active="settings">
            <div className="mx-auto w-full max-w-3xl px-6 py-8">
                <h1 className="font-display text-3xl font-light">Settings</h1>
                <SettingsTabs />
                <div className="mt-6">
                    <Outlet />
                </div>
            </div>
        </AppShell>
    );
}
