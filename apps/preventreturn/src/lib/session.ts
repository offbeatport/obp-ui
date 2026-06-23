import { createServerFn } from "@tanstack/react-start";

export const getSession = createServerFn().handler(async (ctx: any) => {
  try {
    const { auth } = await import("./auth");
    const request: Request = ctx?.request ?? new Request("http://localhost");
    const session = await auth.api.getSession({ headers: request.headers });
    return session ?? null;
  } catch (err) {
    console.error("[getSession error]", err);
    return null;
  }
});
