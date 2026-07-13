import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "~/lib/utils";

// Sub-navigation for the /admin/* pages (engine internals).
const TABS: { to: string; label: string }[] = [
    { to: "/admin/queue", label: "Queue" },
    { to: "/admin/runs", label: "Runs" },
];

export function AdminTabs() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    return (
        <nav className="mt-5 flex gap-1 border-b">
            {TABS.map((t) => {
                const active = pathname === t.to || pathname.startsWith(`${t.to}/`);
                return (
                    <Link
                        key={t.to}
                        to={t.to}
                        className={cn(
                            "-mb-px border-b-2 px-3.5 py-2 text-sm font-medium",
                            active
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
