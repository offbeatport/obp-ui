import { cn } from "obp-ui";
import type { CSSProperties, ReactNode } from "react";

// The gallery's own chrome. Deliberately thin - anything that looks like a component the kit
// should own belongs in the kit, not here. Tokens only, and `text-sm` is the floor.

export function Section({
    id,
    title,
    blurb,
    children,
}: {
    id: string;
    title: ReactNode;
    blurb: ReactNode;
    children: ReactNode;
}) {
    return (
        // scroll-mt clears the sticky header when a sidebar link jumps here.
        <section id={id} className="scroll-mt-24">
            <header className="border-b border-border-soft pb-4">
                <h2 className="font-display text-3xl font-light tracking-tight">{title}</h2>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
            </header>
            <div className="mt-8 space-y-12">{children}</div>
        </section>
    );
}

/**
 * One exported component: its name in mono, what it is for, and its real variants.
 *
 * `name` doubles as the sidebar's sub-navigation entry. The sidebar reads these off the DOM
 * after mount rather than repeating a hand-written list in app.tsx - a list that would go
 * stale the first time someone adds a Spec and forgets. Compound names ("Input · Textarea ·
 * Label") nav under their first part; the anchor id is assigned by the sidebar, which is the
 * only place that knows which section a Spec landed in.
 */
export function Spec({
    name,
    note,
    children,
    bare,
    className,
}: {
    name: string;
    note: ReactNode;
    children: ReactNode;
    /** Drop the card frame - for demos that bring their own surface. */
    bare?: boolean;
    className?: string;
}) {
    return (
        <article data-spec={name} className="scroll-mt-24 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h3 className="font-mono text-sm font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground">{note}</p>
            </div>
            <div
                className={cn(
                    !bare && "rounded-xl border border-border bg-card p-5 shadow-e1",
                    className,
                )}
            >
                {children}
            </div>
        </article>
    );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

/** A labelled variant cell - the label is the prop value being demonstrated. */
export function Cell({
    label,
    children,
    className,
}: {
    label: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex min-w-0 flex-col items-start gap-2", className)}>
            <span className="font-mono text-sm text-faint">{label}</span>
            {children}
        </div>
    );
}

/** A fixed-size bordered stage - shell frames, chat panels, boards. */
export function Frame({
    children,
    className,
    style,
}: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <div
            className={cn(
                "overflow-hidden rounded-xl border border-border bg-background shadow-e1",
                className,
            )}
            style={style}
        >
            {children}
        </div>
    );
}

export function Note({ children }: { children: ReactNode }) {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Exports with nothing to draw - hooks, helpers, constants and their live values. */
export function Api({
    items,
}: {
    items: { name: string; note: ReactNode; value?: ReactNode }[];
}) {
    return (
        <dl className="divide-y divide-border-soft">
            {items.map((it) => (
                <div key={it.name} className="grid gap-1 py-2.5 sm:grid-cols-[16rem_1fr]">
                    <dt className="font-mono text-sm font-semibold text-foreground">{it.name}</dt>
                    <dd className="text-sm text-muted-foreground">
                        {it.note}
                        {it.value !== undefined && (
                            <span className="ml-2 font-mono text-sm text-faint">{it.value}</span>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
