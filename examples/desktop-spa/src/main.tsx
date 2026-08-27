import "./app.css";
import "@xyflow/react/dist/base.css";

import {
    AccountButton,
    AccountMenu,
    AppShell,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    ChatBubble,
    ChatComposer,
    ChatPanel,
    EmptyState,
    EntityRow,
    GradientMark,
    Input,
    LiveDot,
    LogoMark,
    NavItem,
    Rail,
    SectionLabel,
    SegmentedTabs,
    StatTile,
    StatusDot,
    StatusPill,
    TabNav,
    Timeline,
    TimelineDot,
    TimelineItem,
    TitleBar,
    UIProvider,
    WindowControls,
    WindowControlsProvider,
    createTheme,
} from "obp-ui";
import { Home, Inbox, LayoutGrid, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

// A Tauri frontend has no router by default. The nav seam degrades to plain <a href>, which is
// exactly what this probe exercises: no UIProvider Link is supplied.
const theme = createTheme({ namespace: "probe" });
theme.initTheme();
document.documentElement.classList.add("is-desktop");

const COMPANIES = [
    { id: "a", name: "Tripwire", meta: "shipped", tone: "green" as const },
    { id: "b", name: "Almanac", meta: "building", tone: "blue" as const },
    { id: "c", name: "Undertow", meta: "needs you", tone: "violet" as const },
];

function Probe() {
    const [tab, setTab] = useState("overview");
    const [collapsed] = useState(false);

    return (
        <WindowControlsProvider
            value={{
                platform: "windows",
                isMaximized: false,
                minimize: () => {},
                toggleMaximize: () => {},
                close: () => {},
            }}
        >
            <UIProvider pathname="/">
                <AppShell
                    collapsed={collapsed}
                    titleBar={<TitleBar title="obp-ui probe" actions={<WindowControls />} />}
                    rail={
                        <Rail
                            brand={<LogoMark letter="P" />}
                            footer={
                                <AccountMenu
                                    trigger={<AccountButton initial="V" name="Vlad" sub="probe" />}
                                    items={[{ key: "settings", label: "Settings" }]}
                                />
                            }
                        >
                            <NavItem icon={Plus} label="New company" href="/new" tint />
                            <SectionLabel>Overview</SectionLabel>
                            <NavItem icon={Home} label="Home" href="/" active />
                            <NavItem icon={Inbox} label="Inbox" href="/inbox" />
                            <NavItem icon={SlidersHorizontal} label="Guardrails" href="/g" />
                            <NavItem icon={LayoutGrid} label="Portfolio" href="/companies" />
                            <SectionLabel>Companies</SectionLabel>
                            {COMPANIES.map((c) => (
                                <EntityRow
                                    key={c.id}
                                    name={c.name}
                                    href={`/companies/${c.id}`}
                                    metaLabel={c.meta}
                                    statusTone={c.tone}
                                />
                            ))}
                        </Rail>
                    }
                >
                    <div className="mx-auto w-full max-w-4xl px-8 py-10">
                        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-faint">
                            obp-ui / desktop probe
                        </div>
                        <h1 className="font-display text-4xl font-light">Same kit, no router</h1>
                        <p className="mt-2 max-w-xl font-serif text-[17px] italic text-muted-foreground">
                            Rendered by a plain Vite SPA - no SSR, no server functions, no TanStack
                            Router. Every part below comes from obp-ui.
                        </p>

                        <TabNav
                            tabs={[
                                { href: "/", label: "Overview" },
                                { href: "/tasks", label: "Tasks" },
                            ]}
                        />

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Button>Promote bet</Button>
                            <Button variant="success">Approve</Button>
                            <Button variant="outline">Reject</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Badge variant="success">shipped</Badge>
                            <Badge variant="info">building</Badge>
                            <Badge variant="approval">awaiting you</Badge>
                            <StatusPill dotClassName="bg-success">live</StatusPill>
                            <LiveDot label="live" />
                            <StatusDot colorClassName="bg-success" size="lg" />
                        </div>

                        <div className="mt-6">
                            <SegmentedTabs
                                tabs={[
                                    { key: "overview", label: "Overview" },
                                    { key: "tasks", label: "Tasks", badge: 3 },
                                    { key: "code", label: "Code" },
                                ]}
                                active={tab}
                                onSelect={setTab}
                            />
                        </div>

                        <div className="mt-8 grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Portfolio</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-8">
                                        <StatTile value="$12.4k" label="MRR" />
                                        <StatTile value="284" label="users" />
                                        <StatTile value="7/10" label="cold-run" />
                                    </div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <GradientMark name="Tripwire" />
                                        <GradientMark name="Almanac" />
                                        <GradientMark name="Undertow" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Build log</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Timeline>
                                        {[
                                            ["var(--success)", "Signup ships", "2h ago"],
                                            ["var(--info)", "Building checkout", "now"],
                                            ["var(--neutral)", "Pricing page", "queued"],
                                        ].map(([dot, title, meta]) => (
                                            <TimelineItem
                                                key={title}
                                                dot={<TimelineDot color={dot} />}
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold">
                                                        {title}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-faint">
                                                        {meta}
                                                    </div>
                                                </div>
                                            </TimelineItem>
                                        ))}
                                    </Timeline>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-8 h-[320px]">
                            <ChatPanel
                                composer={
                                    <ChatComposer
                                        placeholder="Message the company..."
                                        onSend={async () => {}}
                                    />
                                }
                            >
                                {/* biome-ignore lint/a11y/useValidAriaRole: ChatBubble's own speaker prop, not the ARIA attribute - it is consumed, never spread onto a DOM node */}
                                <ChatBubble
                                    role="user"
                                    text="Make the onboarding shorter."
                                    timestamp="2m"
                                />
                                {/* biome-ignore lint/a11y/useValidAriaRole: as above */}
                                <ChatBubble
                                    role="assistant"
                                    text="Cutting it to one screen and shipping behind a flag."
                                    timestamp="1m"
                                />
                            </ChatPanel>
                        </div>

                        <div className="mt-8">
                            <EmptyState
                                variant="panel"
                                title="No companies yet"
                                action={
                                    <Button size="sm" className="mt-4">
                                        New company
                                    </Button>
                                }
                            >
                                Start one and it shows up here.
                            </EmptyState>
                        </div>

                        <div className="mt-8 max-w-sm">
                            <Input placeholder="A tool that turns X into Y..." />
                        </div>
                    </div>
                </AppShell>
            </UIProvider>
        </WindowControlsProvider>
    );
}

createRoot(document.getElementById("root") as HTMLElement).render(<Probe />);
