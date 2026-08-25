"use client";

// The navigation seam.
//
// Shell components (rail, nav items, tab bars, entity rows) need to render links and know
// which one is active - but the design system must not depend on a router. TanStack Router
// in the web app, whatever the desktop app picks (TanStack Router, a plain state machine,
// even nothing) both satisfy this contract.
//
// Currency is a plain `href: string`. Context rather than prop-drilling because <Link> sits
// four levels under AppShell's public API, behind a runtime nav array; threading a component
// through every layer would put router types back in the package's signatures.
//
// With no provider mounted the package degrades to plain <a href> and `pathname: ""`, which
// is exactly right for a static render or a Storybook-style gallery.

import {
    type AnchorHTMLAttributes,
    type ReactNode,
    createContext,
    useContext,
    useMemo,
} from "react";

export type UILinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    children?: ReactNode;
};

// A plain function type, not React.FC/ComponentType: those narrow the return to
// ReactElement and reject TanStack Router's Link, whose overloads return ReactNode.
export type UILinkComponent = (props: UILinkProps) => ReactNode;

/** Route builders, so the package never hardcodes an app's URL shape. */
export type UIPaths = {
    home(): string;
    inbox(): string;
    guardrails(): string;
    companies(): string;
    newCompany(): string;
    company(slugOrId: string): string;
    admin(sub: "queue" | "runs"): string;
    settings(sub?: "agents" | "guardrails" | "appearance" | "account"): string;
};

export type UINav = {
    Link: UILinkComponent;
    navigate(href: string, opts?: { replace?: boolean }): void;
    /** Current path. "" is a legal "unknown" - active states just stay off. */
    pathname: string;
    paths: UIPaths;
};

const DEFAULT_PATHS: UIPaths = {
    home: () => "/",
    inbox: () => "/inbox",
    guardrails: () => "/guardrails",
    companies: () => "/companies",
    newCompany: () => "/companies/new",
    company: (slugOrId) => `/companies/${encodeURIComponent(slugOrId)}`,
    admin: (sub) => `/admin/${sub}`,
    settings: (sub) => (sub ? `/settings/${sub}` : "/settings"),
};

const FallbackLink: UILinkComponent = ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
        {children}
    </a>
);

const DEFAULT_NAV: UINav = {
    Link: FallbackLink,
    navigate: (href) => {
        if (typeof window !== "undefined") window.location.assign(href);
    },
    pathname: "",
    paths: DEFAULT_PATHS,
};

const NavContext = createContext<UINav>(DEFAULT_NAV);

export function UIProvider({
    Link,
    navigate,
    pathname,
    paths,
    children,
}: {
    Link?: UILinkComponent;
    navigate?: UINav["navigate"];
    pathname?: string;
    paths?: Partial<UIPaths>;
    children: ReactNode;
}) {
    const value = useMemo<UINav>(
        () => ({
            Link: Link ?? DEFAULT_NAV.Link,
            navigate: navigate ?? DEFAULT_NAV.navigate,
            pathname: pathname ?? "",
            paths: { ...DEFAULT_PATHS, ...paths },
        }),
        [Link, navigate, pathname, paths],
    );
    return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

/** Never throws: without a provider you get plain anchors. */
export function useNav(): UINav {
    return useContext(NavContext);
}

/** Exact-match active state. Pass `{ prefix: true }` for section highlighting. */
export function useIsActive(href: string, opts: { prefix?: boolean } = {}): boolean {
    const { pathname } = useNav();
    if (!pathname || !href) return false;
    return opts.prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}
