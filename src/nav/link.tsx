"use client";

import { Slot } from "radix-ui";
import type { ReactNode } from "react";
import { type UILinkProps, useNav } from "./ui-provider";

/**
 * The package's own <Link>: renders whatever the host supplied to <UIProvider>, or a
 * plain <a> when nothing did. Use this everywhere inside the package instead of <a>.
 *
 * `asChild` renders the host link's props onto a single child element, matching the
 * convention the primitives already use (Button, Badge).
 */
export function Link({
    asChild,
    children,
    ...props
}: UILinkProps & { asChild?: boolean }): ReactNode {
    const { Link: HostLink } = useNav();
    if (asChild) {
        return (
            <HostLink {...props}>
                <Slot.Root>{children}</Slot.Root>
            </HostLink>
        );
    }
    return <HostLink {...props}>{children}</HostLink>;
}
