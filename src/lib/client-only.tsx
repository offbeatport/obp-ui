"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

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
