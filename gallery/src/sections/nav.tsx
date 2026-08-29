import {
    Link,
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
                note="the seam that lets shell components render links and know what is active without a router."
            >
                <UIProvider pathname="/settings/agents">
                    <NavReadout href="/settings" />
                </UIProvider>
                <Note>
                    With no provider at all the package falls back to plain anchors and{" "}
                    <code>pathname: ""</code>, so active states just stay off.
                </Note>
            </Spec>

            <Spec
                name="Link"
                note="renders whatever the host gave UIProvider - here, nothing, so a plain anchor."
            >
                <Row className="gap-6">
                    <Cell label="<Link href>">
                        <Link
                            href="#nav"
                            className="text-sm text-primary underline underline-offset-2"
                        >
                            a package Link
                        </Link>
                    </Cell>
                    <Cell label="asChild + an element child">
                        <Link href="#nav" asChild>
                            <span className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm">
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
                note="underlined sub-navigation; the active tab is whichever href the pathname is under."
            >
                <UIProvider pathname="/settings/guardrails">
                    <TabNav tabs={SETTINGS_TABS} className="mt-0" />
                </UIProvider>
                <Note>
                    Mounted here inside a nested provider claiming <code>/settings/guardrails</code>
                    .
                </Note>
            </Spec>

            <Spec
                name="SegmentedTabs"
                note="an iOS-style pill that measures the active tab and slides behind it. Click one - it animates."
            >
                <Row className="gap-5">
                    <SegmentedTabs tabs={SEG_TABS} active={tab} onSelect={setTab} />
                    <Note>
                        active: <span className="font-mono">{tab}</span>
                    </Note>
                </Row>
            </Spec>
        </>
    );
}
