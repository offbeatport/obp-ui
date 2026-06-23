import { createFileRoute } from "@tanstack/react-router";
import { getTechStacks } from "~/lib/project-fns";
import { StacksSection } from "../settings";

export const Route = createFileRoute("/settings/stacks")({
  loader: async () => ({ stacks: await getTechStacks() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: StacksPage,
});

function StacksPage() {
  const { stacks } = Route.useLoaderData();
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 600 }}>
        <StacksSection initial={stacks} />
      </div>
    </div>
  );
}
