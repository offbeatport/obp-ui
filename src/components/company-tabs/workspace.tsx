import type { ReactNode } from "react";
import { CompanyLogo } from "~/components/company-logo";
import type { CompanyTabProps } from "~/components/company-tabs/types";
import type { CompanyAction } from "~/server/data";

// The Workspace tab - an asset gallery of "everything the company is made of": Foundation
// (brand/story/positioning), Product (the slices users use), and Go-to-market (the assets that
// reach buyers). Each asset is a card with a tiny mock preview + a state pill (live/building/planned),
// all derived from the real CompanyDetail (spec / branding / channels) and the task list (actions).

type StateKind = "live" | "building" | "planned";
type Asset = { name: string; sum: string; state: StateKind; mock: ReactNode };

// ---- state pill --------------------------------------------------------------
function StatePill({ state }: { state: StateKind }) {
    if (state === "live")
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                Live
            </span>
        );
    if (state === "building")
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                <span className="size-1.5 rounded-full bg-warning animate-pulse" />
                Building
            </span>
        );
    return (
        <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Planned
        </span>
    );
}

// ---- mock previews (mini CSS UIs made of divs) -------------------------------
function Bar({ w, h = 4 }: { w: string; h?: number }) {
    return <span className="block rounded-full bg-border-soft" style={{ width: w, height: h }} />;
}

function MockWindow({ children, center, overlay }: { children: ReactNode; center?: boolean; overlay?: ReactNode }) {
    return (
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border-soft bg-background">
            <div className="flex items-center gap-1 border-b border-border-soft bg-secondary px-2 py-1.5">
                <span className="size-1.5 rounded-full bg-border" />
                <span className="size-1.5 rounded-full bg-border" />
                <span className="size-1.5 rounded-full bg-border" />
            </div>
            <div
                className={
                    center ? "grid h-[calc(100%-1.75rem)] place-items-center p-2" : "flex flex-col gap-1.5 p-2.5"
                }
            >
                {children}
            </div>
            {overlay}
        </div>
    );
}

const buildOverlay = (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 border-t border-border-soft bg-card/90 px-2 py-1 backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-warning animate-pulse" />
        <span className="font-mono text-[9px] text-warning">building…</span>
        <span className="ml-auto block h-1 w-8 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full w-3/5 bg-warning" />
        </span>
    </div>
);

function DocMock({ building }: { building?: boolean }) {
    return (
        <MockWindow overlay={building ? buildOverlay : undefined}>
            <Bar w="54%" h={8} />
            <Bar w="100%" />
            <Bar w="92%" />
            <Bar w="96%" />
            <Bar w="40%" />
        </MockWindow>
    );
}

function LandingMock() {
    return (
        <MockWindow>
            <Bar w="60%" h={9} />
            <span className="block h-2 w-1/3 rounded-full bg-primary" />
            <Bar w="100%" />
            <Bar w="88%" />
        </MockWindow>
    );
}

function UiMock({ building }: { building?: boolean }) {
    return (
        <MockWindow overlay={building ? buildOverlay : undefined}>
            {[92, 88, 76].map((n) => (
                <div key={n} className="flex items-center gap-2">
                    <Bar w="100%" />
                    <span className="rounded-sm bg-success-soft px-1 font-mono text-[8px] leading-4 text-success">
                        {n}
                    </span>
                </div>
            ))}
        </MockWindow>
    );
}

function BrandMock({ palette }: { palette?: [string, string] }) {
    const swatches = [palette?.[0], palette?.[1], "var(--foreground)", "var(--muted-foreground)"];
    return (
        <MockWindow>
            <div className="flex gap-1.5">
                {swatches.map((c, i) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed palette swatches
                        key={i}
                        className="size-5 rounded-md border border-border-soft"
                        style={{ background: c ?? "var(--accent)" }}
                    />
                ))}
            </div>
            <Bar w="46%" h={6} />
            <Bar w="72%" />
        </MockWindow>
    );
}

function LogoMock({ name, branding }: { name: string; branding?: CompanyTabProps["co"]["branding"] }) {
    return (
        <MockWindow center>
            <CompanyLogo name={name} branding={branding} size={44} />
        </MockWindow>
    );
}

function PlannedMock() {
    return (
        <div className="grid aspect-[16/9] place-items-center rounded-lg border border-dashed border-border bg-secondary/60">
            <div className="grid place-items-center gap-1.5">
                <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5 text-faint"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                </svg>
                <span className="h-1.5 w-10 rounded-full bg-border-soft" />
            </div>
        </div>
    );
}

// ---- card + section ----------------------------------------------------------
function AssetCard({ asset }: { asset: Asset }) {
    return (
        <div className="group rounded-xl border border-border bg-card p-2.5 transition hover:-translate-y-0.5 hover:shadow-sm">
            {asset.mock}
            <div className="mt-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-sm font-semibold text-foreground">{asset.name}</span>
                    <StatePill state={asset.state} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{asset.sum}</p>
            </div>
        </div>
    );
}

function Section({
    icon,
    tint,
    title,
    sub,
    assets,
}: {
    icon: ReactNode;
    tint: string;
    title: string;
    sub: string;
    assets: Asset[];
}) {
    const live = assets.filter((a) => a.state === "live").length;
    return (
        <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
                <span className={`grid size-6 place-items-center rounded-md ${tint}`}>{icon}</span>
                <span className="font-display text-sm font-semibold text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
                <span className="h-px flex-1 bg-border-soft" />
                <span className="font-mono text-[11px] text-faint">
                    {live}/{assets.length} live
                </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-3">
                {assets.map((a) => (
                    <AssetCard key={a.name} asset={a} />
                ))}
            </div>
        </section>
    );
}

// ---- state derivation --------------------------------------------------------
function sliceState(a: CompanyAction | undefined): StateKind {
    if (a?.state === "shipped") return "live";
    if (a?.state === "building") return "building";
    return "planned";
}
function channelState(status: string): StateKind {
    const s = status.toLowerCase();
    if (s === "live" || s === "active" || s === "on") return "live";
    if (s === "building" || s === "draft" || s === "wiring") return "building";
    return "planned";
}
const CHANNEL_LABEL: Record<string, string> = {
    seo: "SEO pages",
    ads: "Ad creatives",
    content: "Content",
    outbound: "Outbound",
    referral: "Referral",
};

const ICON = {
    found: (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
        </svg>
    ),
    prod: (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 2l8 4.5v9L12 20 4 15.5v-9L12 2zM4 6.5L12 11l8-4.5M12 11v9" />
        </svg>
    ),
    gtm: (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z" />
            <path d="M16 9a3 3 0 0 1 0 6" />
        </svg>
    ),
};

// ---- the tab -----------------------------------------------------------------
export function WorkspaceTab({ co, actions }: CompanyTabProps) {
    const { spec } = co;
    if (!spec)
        return (
            <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-accent text-primary">
                    {ICON.prod}
                </span>
                <p className="font-display text-sm font-semibold text-foreground">No assets yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Assets appear as the company is built - brief, landing page, product slices and go-to-market
                    channels.
                </p>
            </div>
        );

    const has = (v: unknown) => (v ? "live" : "planned") as StateKind;
    const pitch = spec.tagline || co.thesis || "the product";

    const foundation: Asset[] = [
        {
            name: "Company Brief",
            sum: `Mission, ICP & pricing - ${spec.icp}.`,
            state: "live",
            mock: <DocMock />,
        },
        {
            name: "Product Requirements",
            sum: "Features broken into small tasks, each with its prompt.",
            state: has(spec.slices?.length),
            mock: <DocMock />,
        },
        { name: "Landing page", sum: `The pitch: ${pitch}`, state: "live", mock: <LandingMock /> },
        {
            name: "Branding & design",
            sum: co.branding?.style || "Palette, type & voice - one coherent look.",
            state: has(co.branding),
            mock: <BrandMock palette={co.branding?.palette} />,
        },
        {
            name: "Logo",
            sum: "The company mark.",
            state: has(co.branding),
            mock: <LogoMock name={co.name} branding={co.branding} />,
        },
        {
            name: "Market Opportunity",
            sum: `${spec.market?.persona ?? "The buyer"} · ${spec.market?.competitors.length ?? 0} competitors.`,
            state: has(spec.market),
            mock: <DocMock />,
        },
    ];

    const byKey = new Map<string, CompanyAction>();
    for (const a of actions) byKey.set(a.title.trim().toLowerCase(), a);
    const product: Asset[] = (spec.slices ?? []).map((s, i) => {
        const match = byKey.get(s.title.trim().toLowerCase()) ?? actions.find((a) => a.n === i + 1);
        const state = sliceState(match);
        return {
            name: s.title,
            sum: s.sub || s.doneWhen || "Part of the core product loop.",
            state,
            mock: state === "planned" ? <PlannedMock /> : <UiMock building={state === "building"} />,
        };
    });

    const gtm: Asset[] = co.channels?.length
        ? co.channels.map((c) => {
              const state = channelState(c.status);
              return {
                  name: CHANNEL_LABEL[c.kind] ?? c.kind,
                  sum: c.budgetIntentUsd
                      ? `Budget intent: $${c.budgetIntentUsd}/mo.`
                      : "A channel that reaches buyers.",
                  state,
                  mock: state === "planned" ? <PlannedMock /> : <DocMock building={state === "building"} />,
              };
          })
        : [
              {
                  name: "Launch post",
                  sum: "The build-in-public announcement.",
                  state: "live",
                  mock: <DocMock />,
              },
              {
                  name: "SEO pages",
                  sum: "Comparison & how-to pages that rank.",
                  state: "planned",
                  mock: <PlannedMock />,
              },
              {
                  name: "Social",
                  sum: "Genuine replies in buyer threads.",
                  state: "planned",
                  mock: <PlannedMock />,
              },
          ];

    return (
        <div>
            <div className="mb-5">
                <h2 className="font-display text-base font-semibold text-foreground">Workspace</h2>
                <p className="text-xs text-muted-foreground">Everything the company is made of.</p>
            </div>
            <Section
                icon={ICON.found}
                tint="bg-accent text-primary"
                title="Foundation"
                sub="the brand, story & positioning"
                assets={foundation}
            />
            <Section
                icon={ICON.prod}
                tint="bg-info-soft text-info"
                title="Product"
                sub="the features users actually use"
                assets={product}
            />
            <Section
                icon={ICON.gtm}
                tint="bg-success-soft text-success"
                title="Go-to-market"
                sub="the assets that reach buyers"
                assets={gtm}
            />
        </div>
    );
}
