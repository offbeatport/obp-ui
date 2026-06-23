import { createContext } from "react";
import type { ContentItem } from "~/db/schema";

// ── Shared types ──────────────────────────────────────────────────────────────

export type ReviewItem = ContentItem & { projectName: string; projectId: number };
export type GenerateItem = {
  playbookId: number; playbookSlug: string; playbookName: string;
  instanceId: number; projectId: number; projectName: string;
};

export type Entry =
  | { kind: "post";     id: string; item: ReviewItem }
  | { kind: "review";   id: string; item: ReviewItem }
  | { kind: "generate"; id: string; item: GenerateItem };

export type Folder = "all" | "post" | "review" | "generate";

// ── Context ───────────────────────────────────────────────────────────────────

export interface InboxCtxValue {
  allEntries: Entry[];
  folderEntries: Entry[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  removeEntry: (id: string) => void;
  reloadQueue: () => Promise<void>;
}

export const InboxCtx = createContext<InboxCtxValue>(null as any);

// ── Platform config (shared) ──────────────────────────────────────────────────

export const PLATFORM_CFG: Record<string, { label: string; color: string }> = {
  reddit:     { label: "Reddit",       color: "#ff4500" },
  hn:         { label: "Hacker News",  color: "#ff6600" },
  twitter:    { label: "X / Twitter",  color: "#1da1f2" },
  linkedin:   { label: "LinkedIn",     color: "#0077b5" },
  newsletter: { label: "Newsletter",   color: "#a78bfa" },
  ph:         { label: "Product Hunt", color: "#da552f" },
  youtube:    { label: "YouTube",      color: "#ff0000" },
  seo:        { label: "SEO / AEO",    color: "#22c55e" },
  bluesky:    { label: "Bluesky",      color: "#0085ff" },
};

export const pc = (p: string) => PLATFORM_CFG[p] ?? { label: p, color: "rgba(165,182,214,0.5)" };

export const ENTRY_COLOR: Record<Entry["kind"], string> = {
  post:     "#a78bfa",
  review:   "#22c55e",
  generate: "#f59e0b",
};
