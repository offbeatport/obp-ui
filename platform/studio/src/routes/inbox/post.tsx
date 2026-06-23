import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";
import { InboxCtx } from "~/lib/inbox-ctx";
import { ContentPane, EmptyPane } from "./-_panes";

export const Route = createFileRoute("/inbox/post")({
  component: PostFolder,
});

function PostFolder() {
  const { folderEntries, selectedId } = useContext(InboxCtx);
  const selected = folderEntries.find(e => e.id === selectedId && e.kind === "post") ?? null;
  if (!selected || selected.kind !== "post") return <EmptyPane />;
  return <ContentPane key={selected.id} entry={selected} />;
}
