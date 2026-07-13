import { createFileRoute, redirect } from "@tanstack/react-router";

// /admin → first sub-tab.
export const Route = createFileRoute("/admin/")({
    beforeLoad: () => {
        throw redirect({ to: "/admin/queue" });
    },
});
