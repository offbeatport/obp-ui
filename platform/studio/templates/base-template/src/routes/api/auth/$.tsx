import { createAPIFileRoute } from "@tanstack/react-start/api";

/**
 * Catch-all route for better-auth.
 * All auth endpoints are handled here: /api/auth/*
 *
 * Examples:
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   GET  /api/auth/session
 *   POST /api/auth/sign-out
 *   GET  /api/auth/callback/github
 */
export const APIRoute = createAPIFileRoute("/api/auth/$")({
  GET: async ({ request }) => {
    const { auth } = await import("../../../lib/auth.js");
    return auth.handler(request);
  },
  POST: async ({ request }) => {
    const { auth } = await import("../../../lib/auth.js");
    return auth.handler(request);
  },
});
