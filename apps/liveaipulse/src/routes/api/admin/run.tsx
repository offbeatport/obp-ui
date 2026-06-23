import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/admin/run") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import("../../../lib/auth");
        const { isAdminEmail } = await import("../../../lib/admin");

        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user || !isAdminEmail(session.user.email)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { startRun } = await import("../../../lib/run-processor");
        return startRun();
      },
    },
  },
});
