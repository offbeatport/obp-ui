import { createFileRoute } from "@tanstack/react-router";
import { getFounderProfile } from "~/lib/project-fns";
import { GitSection } from "../settings";

export const Route = createFileRoute("/settings/source-control")({
  loader: async () => ({ profile: await getFounderProfile() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: GitPage,
});

function GitPage() {
  const { profile } = Route.useLoaderData();
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 600 }}>
        <GitSection initial={profile} />
      </div>
    </div>
  );
}
