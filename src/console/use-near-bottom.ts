"use client";

import { type RefObject, useEffect, useRef } from "react";

export const NEAR_BOTTOM_PX = 40;

export type NearBottomOptions = {
    threshold?: number;
    always?: boolean;
};

export function useNearBottomScroll<T extends HTMLElement = HTMLDivElement>(
    dep: unknown,
    { threshold = NEAR_BOTTOM_PX, always = false }: NearBottomOptions = {},
): RefObject<T | null> {
    const ref = useRef<T>(null);
    useEffect(() => {
        void dep;
        const el = ref.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        if (always || nearBottom) el.scrollTop = el.scrollHeight;
    }, [dep, threshold, always]);
    return ref;
}
