import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";
import { InboxCtx } from "~/lib/inbox-ctx";
import { ContentPane, GeneratePane, EmptyPane, AllClearPane } from "./-_panes";

export const Route = createFileRoute("/inbox/")({
  component: AllFolder,
});

function AllFolder() {
  const { folderEntries, selectedId, allEntries } = useContext(InboxCtx);
  const selected = folderEntries.find(e => e.id === selectedId) ?? null;

  if (allEntries.length === 0) return <AllClearPane />;
  if (!selected) return <EmptyPane />;
  if (selected.kind === "generate") return <GeneratePane key={selected.id} entry={selected} />;
  return <ContentPane key={selected.id} entry={selected} />;
}
