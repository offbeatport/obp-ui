import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import type { ActivityItem, CompanySummary, Tone } from "~/server/data";
import { STAGE_CLASS, TONE_VAR } from "./tone";

// The work-line node glyphs (coICON).
const AREA_ICON = {
    build: "M9 8l-4 4 4 4M15 8l4 4-4 4",
    grow: "M4 17l6-6 3 3 7-7M15 7h5v5",
    run: "M3 12h4l2 6 4-12 2 6h6",
} as const;
type Area = keyof typeof AREA_ICON;
type NodeState = "active" | "needs" | "idle" | "off";

// Feed tone → the mono BUILD/GROW/RUN tag on activity lines.
const TAG: Record<Tone, Area> = {
    green: "run",
    blue: "build",
    violet: "grow",
    slate: "build",
    amber: "grow",
    red: "build",
};

// Derive the three loop-node states from the summary (the contract carries no per-loop model).
function loopStates(c: CompanySummary): Record<Area, NodeState> {
    const live = c.mrr > 0 || c.shipped > 0;
    const building = c.slice?.state === "building";
    const needs = c.needsYou === true;
    return {
        build: building
            ? "active"
            : needs && (c.slice?.state === "awaiting_approval" || c.slice?.state === "blocked")
              ? "needs"
              : c.shipped > 0
                ? "idle"
                : "off",
        grow: c.mrr > 0 ? "active" : live ? "idle" : "off",
        run: live ? "active" : "off",
    };
}

function LoopNode({ area, state, focus }: { area: Area; state: NodeState; focus: boolean }) {
    return (
        <div
            className={`co-lnode co-a-${area} co-st-${state}${focus && state !== "off" ? " co-focus" : ""}`}
        >
            <div className="co-node">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d={AREA_ICON[area]} />
                </svg>
            </div>
            <span className="co-cap">
                <b>{area.toUpperCase()}</b>
            </span>
        </div>
    );
}

// Company card — brandmark · needs-you · build→grow→run work-line · live activity feed.
// Ported from design/v2-prototypes/08-chat-spine-pro-v7.html (coCardHTML / .co-card).
export function CompanyCard({ c, feed }: { c: CompanySummary; feed: ActivityItem[] }) {
    const st = loopStates(c);
    const focus: Area =
        st.build !== "idle" && st.build !== "off" ? "build" : st.grow === "active" ? "grow" : "run";
    const dead = c.status === "archived";

    return (
        <Link
            to="/companies/$slug"
            params={{ slug: c.id }}
            className={`co-card ${STAGE_CLASS[c.tone]}${dead ? " co-dead" : ""}`}
            style={{ "--co-bc": TONE_VAR[c.tone] } as CSSProperties}
        >
            <div className="co-card-head">
                <span className="co-brandmark" aria-hidden="true">
                    {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="co-card-id">
                    <h3>{c.name}</h3>
                </div>
                {c.needsYou && <span className="co-card-needs">needs you</span>}
            </div>

            <div className="co-line-wrap">
                <div className="co-line">
                    <LoopNode area="build" state={st.build} focus={focus === "build"} />
                    <span className="co-link" />
                    <LoopNode area="grow" state={st.grow} focus={focus === "grow"} />
                    <span className="co-link" />
                    <LoopNode area="run" state={st.run} focus={focus === "run"} />
                </div>
            </div>

            <div className="co-feed">
                <div className="co-feed-head">
                    <span className="co-rec" />
                    live activity
                </div>
                <div className="co-feed-lines">
                    {feed.length > 0 ? (
                        feed.map((a) => (
                            <div key={a.id} className="co-feed-line">
                                <span className={`co-tag co-${TAG[a.tone]}`}>
                                    {TAG[a.tone].toUpperCase()}
                                </span>
                                <span className="co-ft">{a.text}</span>
                            </div>
                        ))
                    ) : (
                        <div className="co-feed-line">
                            <span className="co-ft">standing by · no recent activity</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
