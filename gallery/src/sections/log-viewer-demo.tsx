import { Button, type LogEntry, LogViewer } from "obp-ui";
import { useEffect, useState } from "react";

const START = Date.parse("2026-11-06T15:54:50Z");

const OPENING: LogEntry[] = [
    { id: 1, time: START, level: "info", source: "system", message: "attempt 1 started on gpu-02" },
    {
        id: 2,
        time: START + 900,
        level: "warning",
        source: "library",
        message:
            "W1106 15:54:54.156000 56775 redirects.py:35] NOTE: Redirects are currently not supported.",
    },
    {
        id: 3,
        time: START + 1400,
        level: "info",
        source: "library",
        message: "Loading checkpoint shards: 2 of 2",
    },
    {
        id: 4,
        time: START + 2100,
        level: "info",
        message: "Training on 1,840 rows on cuda:0",
        fields: { device: "cuda:0", examples: 1840, held_out: 64, resume: false },
    },
    {
        id: 5,
        time: START + 2600,
        level: "error",
        source: "library",
        message: "RuntimeError: CUDA error: device-side assert triggered",
        detail: [
            "Traceback (most recent call last):",
            '  File "/srv/app/train.py", line 214, in <module>',
            "    run_child(main)",
            '  File "/srv/app/context.py", line 62, in run_child',
            "    main(spec)",
            "RuntimeError: CUDA error: device-side assert triggered",
        ].join("\n"),
    },
];

function step(index: number): LogEntry {
    const loss = 2.4 * Math.exp(-index / 40) + 0.35;
    return {
        id: 100 + index,
        time: START + 3000 + index * 1200,
        level: "info",
        message: `Step ${index} of 200: loss ${loss.toFixed(4)}`,
        fields: {
            step: index,
            steps: 200,
            loss: Number(loss.toFixed(4)),
            learning_rate: 0.0002,
            tokens_per_second: 4120.5,
        },
    };
}

export function LogViewerDemo() {
    const [steps, setSteps] = useState(12);
    const [live, setLive] = useState(false);
    useEffect(() => {
        if (!live) return;
        const timer = window.setInterval(() => setSteps((count) => Math.min(200, count + 1)), 400);
        return () => window.clearInterval(timer);
    }, [live]);
    const entries = [...OPENING, ...Array.from({ length: steps }, (_, index) => step(index + 1))];
    return (
        <div className="flex flex-col gap-3">
            <LogViewer
                entries={entries}
                live={live}
                quietSource="library"
                quietLabel="Show library output"
                fileName="job-42.log"
                label="Job log"
                maxHeight="320px"
            />
            <div>
                <Button variant="outline" size="sm" onClick={() => setLive((value) => !value)}>
                    {live ? "Stop streaming" : "Stream new lines"}
                </Button>
            </div>
        </div>
    );
}
