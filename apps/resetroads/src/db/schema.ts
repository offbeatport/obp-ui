import { idCol, timestamps } from "@offbeatport/db/columns";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const analyses = sqliteTable("analyses", {
  id: idCol(),
  ownerToken: text("owner_token").notNull(),
  decisionType: text("decision_type", {
    enum: ["offer", "freelance", "pivot", "salary", "other"],
  }).notNull(),
  decisionDetail: text("decision_detail"),
  cvFilename: text("cv_filename"),
  cvText: text("cv_text").notNull(),
  profile: text("profile", { mode: "json" }).$type<CvProfile>(),
  gapAnalysis: text("gap_analysis", { mode: "json" }).$type<GapRow[]>(),
  gapJdTitle: text("gap_jd_title"),
  fastDebate: text("fast_debate", { mode: "json" }).$type<Debate>(),
  topDebate: text("top_debate", { mode: "json" }).$type<Debate>(),
  gatedEmail: text("gated_email"),
  ...timestamps,
});

export type DecisionType = "offer" | "freelance" | "pivot" | "salary" | "other";

export interface CvProfile {
  name: string;
  currentTitle: string;
  lastCompany: string;
  location: string;
  yoe: number;
  titles: { role: string; co: string; yrs: string }[];
  skills: string[];
  industries: string[];
  education: { degree: string; school: string; yr: string }[];
  languages: string[];
}

export interface GapRow {
  jd: string;
  cv: string;
  status: "ok" | "partial" | "missing";
}

export interface Stance {
  who: string;
  what: string;
  lean: "take" | "pass" | "neg";
  leanLabel: string;
  body: string;
  kicker?: string;
  tail?: string;
}

export interface DebateRound {
  n: string;
  title: string;
  stances: Stance[];
}

export interface Debate {
  question: string;
  context: string;
  modelsUsed: string;
  runTime: string;
  rounds: DebateRound[];
  verdict: {
    line: string;
    body: string;
    confidence: string;
  };
}
