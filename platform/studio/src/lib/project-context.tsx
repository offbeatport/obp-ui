import { createContext, useContext } from "react";
import type { Project, Product, Channel } from "~/db/schema";
import type { ProjectStats, ScoreBucket, FunnelStage } from "~/lib/project-fns";

export type ProjectContextType = {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  // The idea's primary product (build/deploy/monetize state). Null until promoted.
  product: Product | null;
  setProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
  stats: ProjectStats;
  scores: ScoreBucket[];
  funnel: FunnelStage[];
};

export const ProjectCtx = createContext<ProjectContextType | null>(null);

export function useProjectContext(): ProjectContextType {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProjectContext used outside ProjectDetailPage");
  return ctx;
}
