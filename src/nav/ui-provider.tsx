"use client";

import { CSPProvider } from "@base-ui/react/csp-provider";
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

export type UILinkComponent = (props: UILinkProps) => ReactNode;

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
    nonce,
    children,
}: {
    Link?: UILinkComponent;
    navigate?: UINav["navigate"];
    pathname?: string;
    paths?: Partial<UIPaths>;
    nonce?: string;
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
    return (
        <CSPProvider disableStyleElements nonce={nonce}>
            <NavContext.Provider value={value}>{children}</NavContext.Provider>
        </CSPProvider>
    );
}

export function useNav(): UINav {
    return useContext(NavContext);
}

export function useIsActive(href: string, opts: { prefix?: boolean } = {}): boolean {
    const { pathname } = useNav();
    if (!pathname || !href) return false;
    return opts.prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}
