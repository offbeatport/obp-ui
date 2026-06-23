import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";
import { InboxCtx } from "~/lib/inbox-ctx";
import { ContentPane, EmptyPane } from "./-_panes";

export const Route = createFileRoute("/inbox/review")({
  component: ReviewFolder,
});

function ReviewFolder() {
  const { folderEntries, selectedId } = useContext(InboxCtx);
  const selected = folderEntries.find(e => e.id === selectedId && e.kind === "review") ?? null;
  if (!selected || selected.kind !== "review") return <EmptyPane />;
  return <ContentPane key={selected.id} entry={selected} />;
}
