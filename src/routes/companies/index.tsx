import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { CompanyTile } from "~/components/command-center/shared";
import { listCompanies } from "~/server/data";

// The portfolio grid — every company as a tile (status · MRR · current slice).
// Matches the dashTpl1 companies strip / all-companies view.
export const Route = createFileRoute("/companies/")({
    loader: async () => ({ companies: await listCompanies() }),
    component: Companies,
});

function Companies() {
    const { companies } = Route.useLoaderData();
    const n = companies.length;
    return (
        <AppShell active="companies">
            <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-8">
                <header>
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Companies"}
                    </div>
                    <h1 className="mt-2 font-display text-3xl font-light tracking-tight">
                        Portfolio
                    </h1>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                        {n} compan{n === 1 ? "y" : "ies"} — status, MRR, current slice.
                    </p>
                </header>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {companies.map((co) => (
                        <CompanyTile key={co.slug} co={co} flag={co.needsYou} />
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
