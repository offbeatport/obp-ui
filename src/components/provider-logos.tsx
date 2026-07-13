import type { ReactElement, SVGProps } from "react";

// Simplified, original brand-evoking marks (NOT exact trademarked logos) — clean geometric
// glyphs so the provider buttons/rows read as branded. Swap for official brand SVGs later.
// All use currentColor so they inherit the surrounding text/tile color.
export type ProviderId =
    | "anthropic"
    | "openai"
    | "perplexity"
    | "xai"
    | "google"
    | "openrouter"
    | "zai";

function Base(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        />
    );
}

const MARKS: Record<ProviderId, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
    // radiating burst
    anthropic: (p) => (
        <Base {...p}>
            <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </Base>
    ),
    // interlocking six-fold rosette (simplified)
    openai: (p) => (
        <Base {...p}>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 4.5v3.3M12 16.2v3.3M6.5 7.4l2.9 1.6M14.6 15l2.9 1.6M6.5 16.6l2.9-1.6M14.6 9l2.9-1.6" />
        </Base>
    ),
    // nested concentric squares (seek)
    perplexity: (p) => (
        <Base {...p}>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M12 4v16M8 8h8v8" />
        </Base>
    ),
    // angular slashed X
    xai: (p) => (
        <Base {...p}>
            <path d="M5 5l14 14M19 5l-6 6M5 19l6-6" />
        </Base>
    ),
    // four-point spark
    google: (p) => (
        <Base {...p}>
            <path d="M12 3c.4 4.6 1.4 5.6 6 6-4.6.4-5.6 1.4-6 6-.4-4.6-1.4-5.6-6-6 4.6-.4 5.6-1.4 6-6z" />
        </Base>
    ),
    // linked routing nodes
    openrouter: (p) => (
        <Base {...p}>
            <circle cx="6" cy="12" r="2.4" />
            <circle cx="18" cy="6.5" r="2.4" />
            <circle cx="18" cy="17.5" r="2.4" />
            <path d="M8.2 11l7.6-3.4M8.2 13l7.6 3.4" />
        </Base>
    ),
    // z lettermark
    zai: (p) => (
        <Base {...p}>
            <path d="M7 6h10L7 18h10" />
        </Base>
    ),
};

export function ProviderLogo({ id, className }: { id: ProviderId; className?: string }) {
    const Mark = MARKS[id];
    return <Mark className={className} />;
}
