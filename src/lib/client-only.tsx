"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Render children only after hydration. Router-agnostic replacement for TanStack Router's
 * ClientOnly, so a component that can't survive SSR (canvas measuring, anything reading
 * window on first render) works the same in a Vite SPA that never server-renders at all.
 */
export function ClientOnly({
    children,
    fallback = null,
}: { children: ReactNode; fallback?: ReactNode }) {
    const hydrated = useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
    return <>{hydrated ? children : fallback}</>;
}
