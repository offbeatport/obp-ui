"use client";

import { useCallback, useRef } from "react";

// The staggered entrance for a thread that mounts all at once.
//
// The whole page swaps in on navigation, so without a cascade the opening exchange reads as static
// - it's already "there" before the founder can look at it. Messages that already existed at FIRST
// mount get an increasing animation delay so they arrive one after another; messages that show up
// later (a live reply) get 0 and animate the moment they land.
//
// The cascade is capped at `maxSteps` so a long seeded thread doesn't take forever to settle:
// index 6 and everything after it share the last slot (6 * 260ms = 1.56s to fully arrive).

export const ENTRANCE_STEP_MS = 260;
export const ENTRANCE_MAX_STEPS = 6;

export type EntranceStaggerOptions = {
    /** ms between two consecutive entrances. */
    stepMs?: number;
    /** the highest index that still earns a longer delay. */
    maxSteps?: number;
};

/**
 * Returns `delayFor(index)` - the entrance delay in ms for the message at `index`.
 * `initialCount` is read ONCE, on first render: it is the size of the thread at mount.
 */
export function useEntranceStagger(
    initialCount: number,
    { stepMs = ENTRANCE_STEP_MS, maxSteps = ENTRANCE_MAX_STEPS }: EntranceStaggerOptions = {},
): (index: number) => number {
    // How many messages existed when this chat first mounted - those get the staggered entrance.
    const initial = useRef(initialCount);
    return useCallback(
        (index: number) => (index < initial.current ? Math.min(index, maxSteps) * stepMs : 0),
        [stepMs, maxSteps],
    );
}
