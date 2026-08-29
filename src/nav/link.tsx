"use client";

import type { ReactNode } from "react";
import { asChildVoid } from "../lib/base-ui-compat";
import { type UILinkProps, useNav } from "./ui-provider";

export function Link({
    asChild,
    children,
    ...props
}: UILinkProps & { asChild?: boolean }): ReactNode {
    const { Link: HostLink } = useNav();
    if (asChildVoid(asChild, children)) return null;
    return <HostLink {...props}>{children}</HostLink>;
}
