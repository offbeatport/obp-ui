// The clock formats the log surfaces use. Tiny, but shared: the console pane, the run
// tail and the run rows must all agree on how a time reads.

/** 24h wall clock, zero-padded (`14:03:09`) - the docked console's timestamp column. */
export function hms(t: number): string {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The viewer's locale clock - the run tail's timestamp. */
export function localeTime(t: number): string {
    return new Date(t).toLocaleTimeString();
}

/** Compact relative time for run rows. */
export function ago(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 5) return "now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
