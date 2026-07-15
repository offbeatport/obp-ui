// Bounded fan-out for the thinking passes (scope / chat / spin*): run `work` for `id` at most
// once concurrently. The Set membership is added synchronously BEFORE any await (closing the
// double-claim window) and always removed in finally. Each pass calls this after picking the one
// row it will process this tick.
export async function singleFlight(
    inflight: Set<string>,
    id: string,
    work: () => Promise<void>,
): Promise<void> {
    if (inflight.has(id)) return;
    inflight.add(id);
    try {
        await work();
    } finally {
        inflight.delete(id);
    }
}
