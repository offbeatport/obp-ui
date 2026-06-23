import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/auth/$") as any)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        return auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        return auth.handler(request);
      },
    },
  },
});
