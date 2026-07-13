import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

// SSE log stream for a run. Tails the executor's per-run NDJSON file by SIZE-POLL (not
// fs.watch - macOS FSEvents coalesces/misses appends), buffering any trailing partial
// line so a read that races an append never emits truncated JSON. `id:` carries the byte
// offset, so the browser's Last-Event-ID resumes the stream without re-replaying.
//
// Hardening: pump() is async and driven by setInterval, so calls can overlap. A single
// throw here would be an uncaught exception that crashes the whole web process, so every
// enqueue is guarded (never throws) and pump is non-reentrant.
export const Route = createFileRoute("/api/runs/$runId/logs")({
    server: {
        handlers: {
            GET: async ({ request, params }) => {
                const runId = params.runId;
                const file = join(process.cwd(), ".runs", runId, "log.ndjson");
                const lastEventId = request.headers.get("last-event-id");
                let offset = lastEventId ? Number.parseInt(lastEventId, 10) || 0 : 0;

                const encoder = new TextEncoder();
                let timer: ReturnType<typeof setInterval> | undefined;
                let closed = false;
                let pumping = false;

                const clearTimer = () => {
                    if (timer) clearInterval(timer);
                    timer = undefined;
                };

                const stream = new ReadableStream<Uint8Array>({
                    start(controller) {
                        const safeEnqueue = (s: string): boolean => {
                            if (closed) return false;
                            try {
                                controller.enqueue(encoder.encode(s));
                                return true;
                            } catch {
                                closed = true; // controller cancelled/closed under us
                                clearTimer();
                                return false;
                            }
                        };
                        const close = () => {
                            if (closed) return;
                            closed = true;
                            clearTimer();
                            try {
                                controller.close();
                            } catch {
                                /* already closed */
                            }
                        };

                        const pump = async () => {
                            if (closed || pumping) return; // non-reentrant: at most one read in flight
                            pumping = true;
                            try {
                                let buf: Buffer;
                                try {
                                    buf = await readFile(file);
                                } catch {
                                    return; // file not created yet - keep polling
                                }
                                if (closed) return;
                                if (offset > buf.length) offset = 0; // file reset/truncated
                                const rest = buf.subarray(offset);
                                const lastNl = rest.lastIndexOf(0x0a);
                                if (lastNl < 0) return; // only a partial line so far
                                const complete = rest.subarray(0, lastNl + 1);
                                offset += complete.length;
                                for (const line of complete.toString("utf8").split("\n")) {
                                    if (!line) continue;
                                    if (!safeEnqueue(`id: ${offset}\ndata: ${line}\n\n`)) return;
                                    try {
                                        if (
                                            (JSON.parse(line) as { type?: string }).type === "end"
                                        ) {
                                            close();
                                            return;
                                        }
                                    } catch {
                                        /* non-JSON line - ignore */
                                    }
                                }
                            } finally {
                                pumping = false;
                            }
                        };

                        safeEnqueue(": open\n\n"); // flush headers promptly
                        void pump();
                        timer = setInterval(() => void pump(), 250);
                    },
                    cancel() {
                        closed = true;
                        clearTimer();
                    },
                });

                return new Response(stream, {
                    headers: {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache, no-transform",
                        Connection: "keep-alive",
                        "X-Accel-Buffering": "no",
                    },
                });
            },
        },
    },
});
