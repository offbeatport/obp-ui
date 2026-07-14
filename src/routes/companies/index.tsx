import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { CompanyCard } from "~/components/command-center/company-card";
import { TONE } from "~/components/command-center/tone";
import { listActivity, listCompanies } from "~/server/data";

export const Route = createFileRoute("/companies/")({
    loader: async () => {
        const [companies, activity] = await Promise.all([listCompanies(), listActivity()]);
        return { companies, activity };
    },
    component: Portfolio,
});

// Portfolio — the live prototype's renderAllCompanies() / .allco-view:
// heading · full company grid · oversight ledger ("what the AI did on your behalf").
// design/v2-prototypes/08-chat-spine-pro-v7.html.
function Portfolio() {
    const { companies, activity } = Route.useLoaderData();
    const n = companies.length;
    return (
        <AppShell active="companies">
            <div className="cc px-5 pb-24">
                <div className="allco">
                    <div className="allco-head">
                        <Link to="/" className="home-back">
                            <ArrowLeft className="size-3.5" /> Home
                        </Link>
                        <h1 className="allco-h">All companies</h1>
                        <p className="home-hero-sub">
                            {n} {n === 1 ? "company" : "companies"} in your portfolio
                        </p>
                    </div>

                    <div className="home-cos pro-wide">
                        <div className="co-grid">
                            {companies.map((c) => (
                                <CompanyCard
                                    key={c.slug}
                                    c={c}
                                    feed={activity.filter((a) => a.companySlug === c.slug)}
                                />
                            ))}
                        </div>
                    </div>

                    {activity.length > 0 && (
                        <div className="pro-wide">
                            <section className="pc">
                                <div className="pc-head">
                                    <span className="pc-kicker k-auto">Oversight</span>
                                    <h3>What the AI did on your behalf</h3>
                                    <span className="pc-sub">last 7 days</span>
                                </div>
                                <div className="pc-body">
                                    <div className="ov-intro">
                                        <span
                                            className="grid size-[26px] flex-none place-items-center rounded-lg bg-accent text-accent-foreground"
                                            aria-hidden="true"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                width="15"
                                                height="15"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M3 12a9 9 0 0 1 18 0" />
                                                <circle cx="12" cy="12" r="2.4" />
                                            </svg>
                                        </span>
                                        <span>
                                            <b>{activity.length} actions</b> recently — each company
                                            runs its own build loop on autopilot.
                                        </span>
                                    </div>
                                    <div className="ov-card">
                                        {activity.map((a) => (
                                            <div key={a.id} className="ov-row">
                                                <span className={`ov-av ${TONE[a.tone].solid}`}>
                                                    {(a.companyName ?? "?").charAt(0)}
                                                </span>
                                                <div className="ov-bd">
                                                    <div className="ov-t">{a.text}</div>
                                                    <div className="ov-m">
                                                        <b>{a.companyName}</b>
                                                    </div>
                                                </div>
                                                <span className="ov-time">{a.ago}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
