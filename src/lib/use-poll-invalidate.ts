import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

// Re-run the route loader every `ms` so DB-backed views (inbox, opportunities, a company's
// build status, the spin chat) stream in without a manual reload. Pass enabled=false to pause
// (e.g. once a flow is committed). One place owns the interval + cleanup.
export function usePollInvalidate(ms: number, enabled = true): void {
    const router = useRouter();
    useEffect(() => {
        if (!enabled) return;
        const t = setInterval(() => void router.invalidate(), ms);
        return () => clearInterval(t);
    }, [ms, enabled, router]);
}
