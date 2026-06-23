import { createFileRoute } from "@tanstack/react-router";
import { getFounderProfile } from "~/lib/project-fns";
import { ProfileSection } from "../settings";

export const Route = createFileRoute("/settings/profile")({
  loader: async () => ({ profile: await getFounderProfile() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: ProfilePage,
});

function ProfilePage() {
  const { profile } = Route.useLoaderData();
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 600 }}>
        <ProfileSection initial={profile} />
      </div>
    </div>
  );
}
