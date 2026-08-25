"use client";

import { type RefObject, useEffect, useRef } from "react";

// Auto-scroll for an append-only log box. The default is "follow the tail, but only if the
// reader is already there": scrolling up to read something must not be yanked back the
// moment the next line lands. `always` is the run tail's older behaviour (it jumps to the
// bottom on every append) - kept reachable rather than silently changed.

/** px from the bottom that still counts as "near" - about two log lines. */
export const NEAR_BOTTOM_PX = 40;

export type NearBottomOptions = {
    /** How close to the bottom still counts as "near". Default `NEAR_BOTTOM_PX`. */
    threshold?: number;
    /** Stick to the bottom even when the reader has scrolled up. */
    always?: boolean;
};

/**
 * Returns the ref to put on the scroll container. Pass whatever changes when a line is
 * appended (the lines array, a count) as `dep`.
 */
export function useNearBottomScroll<T extends HTMLElement = HTMLDivElement>(
    dep: unknown,
    { threshold = NEAR_BOTTOM_PX, always = false }: NearBottomOptions = {},
): RefObject<T | null> {
    const ref = useRef<T>(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on each append
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        if (always || nearBottom) el.scrollTop = el.scrollHeight;
    }, [dep, threshold, always]);
    return ref;
}
