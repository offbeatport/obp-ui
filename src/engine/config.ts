// Executor tunables. LEASE_MS >> HEARTBEAT_MS so a GC/IO pause can't expire a live
// lease (which would let the periodic sweep wrongly reclaim a running run).
export const config = {
    pollMs: 1000,
    heartbeatMs: 15_000,
    leaseMs: 60_000,
    maxAttempts: 3,
    // In-run build↔validate iterations before a run gives up: a red doneWhen is fed back
    // into the SAME session to fix, not thrown away. This is the main cold-run pass-rate
    // lever. Bounded by wallClockMs regardless (each iteration shares the run's abort).
    maxBuildIters: 4,
    wallClockMs: 20 * 60 * 1000,
    maxConcurrentRuns: 2,
    portRange: [43000, 43999] as [number, number],
    runsDir: ".runs",
};

export type Config = typeof config;
