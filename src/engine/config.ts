// Executor tunables. LEASE_MS >> HEARTBEAT_MS so a GC/IO pause can't expire a live
// lease (which would let the periodic sweep wrongly reclaim a running run).
export const config = {
  pollMs: 1000,
  heartbeatMs: 15_000,
  leaseMs: 60_000,
  maxAttempts: 3,
  wallClockMs: 20 * 60 * 1000,
  maxConcurrentRuns: 2,
  portRange: [43000, 43999] as [number, number],
  runsDir: ".runs",
};

export type Config = typeof config;
