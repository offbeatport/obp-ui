"use client";

import { useCallback, useRef } from "react";

export const ENTRANCE_STEP_MS = 260;
export const ENTRANCE_MAX_STEPS = 6;

export type EntranceStaggerOptions = {
    stepMs?: number;
    maxSteps?: number;
};

export function useEntranceStagger(
    initialCount: number,
    { stepMs = ENTRANCE_STEP_MS, maxSteps = ENTRANCE_MAX_STEPS }: EntranceStaggerOptions = {},
): (index: number) => number {
    const initial = useRef(initialCount);
    return useCallback(
        (index: number) => (index < initial.current ? Math.min(index, maxSteps) * stepMs : 0),
        [stepMs, maxSteps],
    );
}
