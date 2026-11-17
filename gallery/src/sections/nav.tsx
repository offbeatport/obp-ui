import {
    Link,
    PageContents,
    type PageContentsItem,
    type SegTab,
    SegmentedTabs,
    TabNav,
    type TabNavItem,
    UIProvider,
    useIsActive,
    useNav,
} from "obp-ui";
import { useState } from "react";
import { Api, Cell, Note, Row, Spec } from "../kit";

const SETTINGS_TABS: TabNavItem[] = [
    { href: "/settings", label: "Overview" },
    { href: "/settings/agents", label: "Agents" },
    { href: "/settings/guardrails", label: "Guardrails" },
    { href: "/settings/appearance", label: "Appearance" },
    { href: "/settings/account", label: "Account" },
];

const SEG_TABS: SegTab[] = [
    { key: "overview", label: "Overview" },
    { key: "build", label: "Build", badge: 3 },
    { key: "grow", label: "Grow" },
    { key: "run", label: "Run" },
    { key: "setup", label: "Setup" },
];

const CONTENTS: PageContentsItem[] = [
    { id: "contents-purpose", label: "Purpose" },
    { id: "contents-data", label: "Training data" },
    { id: "contents-evaluation", label: "Evaluation" },
    { id: "contents-limits", label: "Limits" },
];

function ContentsDemo() {
    return (
        <div className="grid h-64 grid-cols-[1fr_12rem] gap-6 overflow-y-auto rounded-lg border p-4">
            <div className="flex flex-col gap-6">
                {CONTENTS.map((item) => (
                    <section key={item.id} id={item.id} className="flex min-h-48 flex-col gap-1">
                        <h3 className="text-base font-semibold">{item.label}</h3>
                        <p className="text-sm text-muted-foreground">
                            Scroll this box; the list on the right follows.
                        </p>
                    </section>
                ))}
            </div>
            <PageContents items={CONTENTS} offset={24} className="sticky top-0 self-start" />
        </div>
    );
}

function NavReadout({ href }: { href: string }) {
    const { pathname, paths } = useNav();
    const active = useIsActive(href, { prefix: true });
    return (
        <Api
            items={[
                {
                    name: "useNav().pathname",
                    note: "the host's current path.",
                    value: pathname || '""',
                },
                {
                    name: `useIsActive("${href}", { prefix: true })`,
                    note: "exact match, or any child route under it.",
                    value: String(active),
                },
                {
                    name: 'paths.company("ledgerly")',
                    note: "route shapes are a prop too - a host with another URL scheme remaps every link.",
                    value: paths.company("ledgerly"),
                },
            ]}
        />
    );
}

export function NavSection() {
    const [tab, setTab] = useState("build");

    return (
        <>
            <Spec
                name="UIProvider · useNav · useIsActive"
                note="Links and active state without a router."
            >
                <UIProvider pathname="/settings/agents">
                    <NavReadout href="/settings" />
                </UIProvider>
                <Note>
                    With no provider at all the package falls back to plain anchors and{" "}
                    <code>pathname: ""</code>, so active states just stay off.
                </Note>
            </Spec>

            <Spec name="Link" note="Host link, or a plain anchor.">
                <Row className="gap-6">
                    <Cell label="<Link href>">
                        <Link
                            href="#nav"
                            className="text-base text-primary underline underline-offset-2"
                        >
                            a package Link
                        </Link>
                    </Cell>
                    <Cell label="asChild + an element child">
                        <Link href="#nav" asChild>
                            <span className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-base">
                                identical with the prop or without it
                            </span>
                        </Link>
                    </Cell>
                    <Cell label='asChild + "a bare string"'>
                        <div className="flex h-9 w-48 items-center justify-center rounded-md border border-border border-dashed">
                            <Link href="#nav" asChild>
                                a bare string
                            </Link>
                        </div>
                    </Cell>
                </Row>
                <Note>
                    <code>asChild</code> on <code>Link</code> is kept for API symmetry and does not
                    compose: the host's own component owns the <code>href</code> and the client-side
                    navigation, so nothing is merged onto the child and an element child renders the
                    same markup with the prop or without it. Its one effect is subtraction - when
                    the child is not a single element (a bare string, a number, a fragment, or two
                    children) the entire link is dropped, which is why the dashed box above is
                    empty.
                </Note>
            </Spec>

            <Spec
                name="TabNav"
                note="Underlined link tabs, active by pathname; 36px, size sm 32px."
            >
                <UIProvider pathname="/settings/guardrails">
                    <TabNav tabs={SETTINGS_TABS} label="Settings pages" className="mb-3" />
                    <TabNav
                        tabs={SETTINGS_TABS}
                        label="Settings pages, small"
                        size="sm"
                        className="mb-3"
                    />
                </UIProvider>
                <Note>
                    Mounted inside a nested provider claiming <code>/settings/guardrails</code>.
                    Overview's <code>/settings</code> matches too, as its parent; the longest
                    matching <code>href</code> wins, so a section's index tab sits beside its
                    children. Each tab is a real link (middle-click, back button, deep links), the
                    active one carries <code>aria-current="page"</code>, and Tab shows the focus
                    ring.
                </Note>
            </Spec>

            <Spec
                name="PageContents"
                note="A document's section list; the section in view is marked."
            >
                <ContentsDemo />
                <Note>
                    Follows the nearest scrolling ancestor, so it works inside an app shell's
                    scrolling main. A section counts once its top passes <code>offset</code>
                    pixels below the scroller's top; at the end of the page the last section is
                    marked. A clicked entry stays marked until the reader scrolls. Put it in a{" "}
                    <code>sticky</code> column.
                </Note>
            </Spec>

            <Spec
                name="SegmentedTabs"
                note="Square, 36px; the active tab takes the selection fill. size sm is 34px."
            >
                <Row className="gap-5">
                    <SegmentedTabs tabs={SEG_TABS} active={tab} onSelect={setTab} />
                    <SegmentedTabs tabs={SEG_TABS} active={tab} onSelect={setTab} size="sm" />
                    <Note>
                        active: <span className="font-mono">{tab}</span>
                    </Note>
                </Row>
            </Spec>
        </>
    );
}
