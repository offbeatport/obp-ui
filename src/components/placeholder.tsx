// Scaffolding stub for the route tree - each lane replaces its route body with the real UI.
export function Placeholder({
    kicker,
    title,
    sub,
    lane,
}: {
    kicker: string;
    title: string;
    sub: string;
    lane: string;
}) {
    return (
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16 text-center">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">{kicker}</div>
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight">{title}</h1>
            <p className="mt-3 text-muted-foreground">{sub}</p>
            <p className="mt-1 font-mono text-xs text-faint">placeholder · lane: {lane}</p>
        </div>
    );
}
