import { ClientOnly } from "@tanstack/react-router";
import type { CompanyDetail } from "~/server/data";
import { CompanyCanvas } from "./company-canvas";

// React Flow measures DOM size (ResizeObserver/d3-zoom) at mount, which the SSR pass can't do, so
// the canvas mounts CLIENT-ONLY inside the otherwise-SSR'd company route. The parent MUST have a
// real height (h-full inside a flex-1/min-h-0 cell) or React Flow collapses to 0 → blank canvas.
export function CompanyCanvasClient({ detail }: { detail: CompanyDetail }) {
    return (
        <div className="h-full w-full">
            <ClientOnly fallback={<div className="h-full w-full" />}>
                <CompanyCanvas detail={detail} />
            </ClientOnly>
        </div>
    );
}
