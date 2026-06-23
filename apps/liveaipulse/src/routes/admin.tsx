import {
  createFileRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const checkAdminSession = createServerFn().handler(async () => {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const { auth } = await import("../lib/auth");
  const { isAdminEmail } = await import("../lib/admin");

  const headers = getRequestHeaders() as unknown as Headers;
  const session = await auth.api.getSession({ headers });

  if (!session?.user || !isAdminEmail(session.user.email)) {
    throw redirect({ to: "/login" });
  }

  return { user: session.user };
});

export const Route = createFileRoute("/admin")({
  loader: () => checkAdminSession(),
  component: () => <Outlet />,
});
