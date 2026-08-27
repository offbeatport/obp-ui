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
import { Api, Note, Row, Spec } from "../kit";

// The navigation seam. The gallery mounts <UIProvider> with NO Link, so every nav component
// degrades to a plain <a href> - exactly the "static render / gallery" case the seam is
// designed for. Active state comes from `pathname`, so the demos below nest a second provider
// that claims a route.

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

/** Reads the seam back out - what a shell component sees when it asks. */
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
                <Row>
                    <Link href="#nav" className="text-sm text-primary underline underline-offset-2">
                        a package Link
                    </Link>
                    <Link href="#nav" asChild>
                        <span className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm">
                            asChild - props land on the child
                        </span>
                    </Link>
                </Row>
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
