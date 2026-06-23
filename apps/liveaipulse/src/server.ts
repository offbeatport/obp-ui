import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { scheduleDailyRun } from "./lib/scheduler";

scheduleDailyRun();

const serverEntry = createServerEntry({
  fetch(request: Request) {
    return handler.fetch(request);
  },
});

// Only start the HTTP server in production. During `vite dev`, Vite owns
// the server - starting a second listener here would EADDRINUSE on HMR reload.
if (import.meta.env.PROD) {
  const { serve } = await import("@hono/node-server");
  const { serveStatic } = await import("@hono/node-server/serve-static");
  const { Hono } = await import("hono");

  const app = new Hono();
  app.use("/assets/*", serveStatic({ root: "./dist/client" }));
  app.all("*", (c) => serverEntry.fetch(c.req.raw));

  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
    console.log(`[server] Listening on http://0.0.0.0:${info.port}`);
  });
}

export default serverEntry;
