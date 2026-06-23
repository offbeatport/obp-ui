import { createFileRoute, Link, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "../lib/session";
import { createServerFn } from "@tanstack/react-start";
import { SettingsLayout, SettingsNavItem } from "@offbeatport/blocks/layouts";
import { useRouterState } from "@tanstack/react-router";

export const loadSettings = createServerFn().handler(async (ctx: any) => {
  try {
    const { auth } = await import("../lib/auth");
    const { db } = await import("../db/client");
    const { merchants, merchantSettings } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    const request: Request = ctx?.request ?? new Request("http://localhost");
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;
    const merchant = await db.query.merchants.findFirst({ where: eq(merchants.userId, session.user.id) });
    if (!merchant) return null;
    const settings = await db.query.merchantSettings.findFirst({ where: eq(merchantSettings.merchantId, merchant.id) });
    return { merchantId: merchant.id, shopDomain: merchant.shopDomain, settings };
  } catch (err) {
    console.error("[loadSettings error]", err);
    return null;
  }
});

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) throw redirect({ to: "/login" });
    return { session };
  },
  loader: async () => loadSettings(),
  component: SettingsShell,
});

function NavItem({ to, label }: { to: string; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to;
  return (
    <SettingsNavItem href={to} active={active}>
      {label}
    </SettingsNavItem>
  );
}

function SettingsShell() {
  const loaderData = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const titles: Record<string, { title: string; description: string }> = {
    "/settings": { title: "Agent", description: "Sensitivity, thresholds and delivery channels." },
    "/settings/messages": { title: "Messages", description: "How the agent communicates with buyers." },
    "/settings/exclusions": { title: "Exclusions", description: "Order types and products to skip." },
    "/settings/billing": { title: "Billing", description: "Your plan, usage, and payment details." },
  };

  const { title, description } = titles[pathname] ?? titles["/settings"];

  return (
    <SettingsLayout
      nav={
        <>
          <NavItem to="/settings" label="Agent" />
          <NavItem to="/settings/messages" label="Messages" />
          <NavItem to="/settings/exclusions" label="Exclusions" />
          <NavItem to="/settings/billing" label="Billing" />
        </>
      }
      title={title}
      description={description}
    >
      <Outlet context={{ loaderData }} />
    </SettingsLayout>
  );
}
