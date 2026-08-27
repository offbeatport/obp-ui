import {
    Home,
    Inbox,
    LayoutGrid,
    LogOut,
    Plus,
    Settings2,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import { Badge, Button, LogoMark, StatusPill, type Tone } from "obp-ui";
import {
    AccountButton,
    AccountMenu,
    type AccountMenuItem,
    AppShell,
    EmptyStateCard,
    EntityRow,
    NavItem,
    Rail,
    SectionLabel,
    TitleBar,
    WindowControls,
    type WindowControlsApi,
    WindowControlsProvider,
    useRail,
    useRailCollapsed,
    useWindowControls,
} from "obp-ui/shell";
import { useState } from "react";
import { Api, Frame, Note, Row, Spec } from "../kit";

// The application frame. Every piece is content-free: nav arrays, company rows, menu entries
// and copy are domain data that arrive as props - which is why the fixtures below live here
// and not in the package.
//
// Note the two import lines. The frame comes from "obp-ui/shell", not the root barrel, because
// mounting it makes an app look like this one - see the header of src/index.ts. The gallery
// writes what a consumer writes, so the seam is visible here too.

const COMPANIES: { name: string; meta: string; tone: Tone; badge?: string }[] = [
    { name: "Ledgerly", meta: "$1.2k/mo · building", tone: "blue", badge: "INBOX" },
    { name: "Quietbill", meta: "$0/mo · idle", tone: "slate" },
    { name: "Harbourline", meta: "$340/mo · live", tone: "green" },
    { name: "Nudge", meta: "paused · needs you", tone: "violet" },
];

const ACCOUNT_ITEMS: AccountMenuItem[] = [
    { icon: <Settings2 />, label: "Settings", href: "/settings" },
    { icon: <ShieldCheck />, label: "Guardrails", href: "/guardrails" },
    { icon: <LogOut />, label: "Sign out", separatorBefore: true, destructive: true },
];

/** Reads AppShell's collapse state off the rail context - no prop drilling. */
function RailReadout() {
    const rail = useRail();
    const collapsed = useRailCollapsed();
    return (
        <Row>
            <Button size="sm" variant="outline" onClick={rail.toggle}>
                {collapsed ? "Expand" : "Collapse"} the rail
            </Button>
            <span className="font-mono text-sm text-faint">
                useRailCollapsed() → {String(collapsed)}
            </span>
        </Row>
    );
}

/** null on the web (no provider) - callers must handle that. */
function WindowReadout() {
    const win = useWindowControls();
    return (
        <p className="mt-2 font-mono text-sm text-faint">
            useWindowControls() → {win ? `${win.platform} · maximized ${win.isMaximized}` : "null"}
        </p>
    );
}

export function ShellSection() {
    const [selected, setSelected] = useState("Ledgerly");
    const [maximized, setMaximized] = useState(false);

    // A fake native window: on the web there is no provider and <WindowControls> renders
    // nothing, so the gallery supplies one to make the buttons real.
    const win: WindowControlsApi = {
        platform: "windows",
        isMaximized: maximized,
        minimize: () => {},
        toggleMaximize: () => setMaximized((m) => !m),
        close: () => {},
    };

    return (
        <>
            <Spec
                name="AppShell · Rail · NavItem · SectionLabel · EntityRow · AccountButton · AccountMenu"
                note="the whole frame in one box. The chevron on the rail's edge collapses it; ⋯ on a row opens its menu."
                bare
            >
                <Frame className="h-[620px]">
                    <AppShell
                        className="h-full"
                        rail={
                            <Rail
                                brand={
                                    <span className="flex items-center gap-2">
                                        <LogoMark />
                                        <span className="font-display text-lg font-semibold tracking-tight">
                                            obp-ui
                                        </span>
                                    </span>
                                }
                                brandCollapsed={<LogoMark />}
                                brandHref="#shell"
                                brandLabel="Home"
                                footer={
                                    <AccountMenu
                                        trigger={
                                            <AccountButton
                                                initial="V"
                                                name="Vlad"
                                                sub="$1.2k MRR · 7 companies"
                                            />
                                        }
                                        items={ACCOUNT_ITEMS}
                                    />
                                }
                            >
                                <NavItem icon={Plus} label="New company" href="#shell" tint />
                                <NavItem icon={Home} label="Home" href="#shell" active />
                                <NavItem icon={Inbox} label="Inbox" href="#shell" />
                                <NavItem icon={LayoutGrid} label="Portfolio" href="#shell" />
                                <NavItem
                                    icon={ShieldCheck}
                                    label="Guardrails"
                                    locked
                                    title="Locked until a company ships"
                                />
                                <SectionLabel>Companies</SectionLabel>
                                {COMPANIES.map((c) => (
                                    <EntityRow
                                        key={c.name}
                                        id={c.name}
                                        name={c.name}
                                        href="#shell"
                                        metaLabel={c.meta}
                                        statusTone={c.tone}
                                        badge={c.badge}
                                        selected={selected === c.name}
                                        actions={[
                                            {
                                                icon: <Settings2 className="size-4" />,
                                                label: "Settings",
                                                onSelect: () => setSelected(c.name),
                                            },
                                            {
                                                icon: <Trash2 className="size-4" />,
                                                label: "Kill",
                                                destructive: true,
                                            },
                                        ]}
                                    />
                                ))}
                            </Rail>
                        }
                    >
                        <div className="space-y-5 p-8">
                            <div className="flex items-center gap-3">
                                <h4 className="font-display text-2xl font-light tracking-tight">
                                    Portfolio
                                </h4>
                                <Badge variant="info">4 companies</Badge>
                                <StatusPill
                                    variant="soft"
                                    className="ml-auto bg-success-soft text-success"
                                >
                                    all healthy
                                </StatusPill>
                            </div>
                            <p className="max-w-prose text-sm text-muted-foreground">
                                The workspace column is a slot - AppShell owns nothing but the grid,
                                the collapse state and where the rail sits. It also takes a{" "}
                                <code>console</code> slot for a globally-mounted overlay, kept out
                                of the grid so its root div can't take a cell.
                            </p>
                            <RailReadout />
                            <p className="font-mono text-sm text-faint">selected row: {selected}</p>
                        </div>
                    </AppShell>
                </Frame>
                <Note>
                    Clicking a row's ⋯ → Settings marks it selected, so the paper fill + terracotta
                    edge bar are visible on a different row.
                </Note>
            </Spec>

            <Spec
                name="EmptyStateCard"
                note="the dashed CTA that stands in for a list inside the rail - all copy is a prop."
                bare
            >
                <Frame className="w-[264px] bg-secondary py-2">
                    <EmptyStateCard
                        title="No companies yet"
                        description="Start with a thought. The agent scopes it into a company."
                        actionLabel="New company"
                        actionIcon={<Plus className="size-3.5" />}
                        actionHref="#shell"
                    />
                </Frame>
            </Spec>

            <Spec
                name="TitleBar · WindowControls · WindowControlsProvider"
                note="the desktop strip you drag to move the window. Inert on the web; the native calls arrive through the provider."
                bare
            >
                <WindowControlsProvider value={win}>
                    <Frame>
                        <TitleBar
                            leading={<LogoMark />}
                            title="Ledgerly - slice 3 of 9"
                            actions={<WindowControls />}
                        />
                        <div className="p-6">
                            <p className="text-sm text-muted-foreground">
                                Window content. <code>platform: "windows"</code> here - on macOS the
                                OS paints the traffic lights and{" "}
                                <code>&lt;WindowControls /&gt;</code> renders nothing unless you
                                pass <code>force</code>.
                            </p>
                            <WindowReadout />
                        </div>
                    </Frame>
                </WindowControlsProvider>
                <div className="mt-4">
                    <WindowReadout />
                    <Note>…and the same hook outside the provider.</Note>
                </div>
            </Spec>

            <Spec
                name="Seams & types"
                note="the context plumbing the frame publishes, and the shapes its props take."
                bare
            >
                <Api
                    items={[
                        {
                            name: "RailProvider · RailState",
                            note: "AppShell mounts it; a rail rendered outside one reads as expanded with inert toggles.",
                        },
                        {
                            name: "useRail() · useRailCollapsed()",
                            note: "the collapse state, read anywhere under the shell. Never throws.",
                        },
                        {
                            name: "IconComponent",
                            note: "any component taking a className - lucide satisfies it structurally, so the kit never depends on an icon set.",
                        },
                        {
                            name: "EntityRowAction · AccountMenuItem",
                            note: "one ⋯ / menu entry: an icon, a label, and either an href or an onSelect.",
                        },
                        {
                            name: "WindowPlatform",
                            note: '"macos" | "windows" | "linux" - matches @tauri-apps/plugin-os platform().',
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
