import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";
import { InboxCtx } from "~/lib/inbox-ctx";
import { GeneratePane, EmptyPane } from "./-_panes";

export const Route = createFileRoute("/inbox/generate")({
  component: GenerateFolder,
});

function GenerateFolder() {
  const { folderEntries, selectedId } = useContext(InboxCtx);
  const selected = folderEntries.find(e => e.id === selectedId && e.kind === "generate") ?? null;
  if (!selected || selected.kind !== "generate") return <EmptyPane />;
  return <GeneratePane key={selected.id} entry={selected} />;
}
