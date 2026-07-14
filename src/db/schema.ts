import { randomUUID } from "node:crypto";
// C Slop Slop - data model (docs/SPEC.md).
// One flat schema; JSON columns hold the shape-y bits (action.payload, company.channels/metrics/pricing, run.checkpoint, draft.data).
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { DraftData, SpinGuardrails } from "../config/spin.js";

// shared column helpers
const pk = () =>
    text("id")
        .primaryKey()
        .$defaultFn(() => randomUUID());
const createdAt = () =>
    integer("created_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date());

// ---- JSON shapes (match SPEC field shapes) ----
export type Channel = {
    kind: "seo" | "ads" | "content" | "outbound" | "referral";
    status: string;
    budgetIntentUsd?: number;
};
export type Metrics = { mrr?: number; users?: number; adoption?: number };
export type Pricing = {
    plan?: string;
    priceUsd?: number;
    interval?: "month" | "year";
    [k: string]: unknown;
};
export type CodePayload = { doneWhen: string; diff?: string; previewUrl?: string };
export type MessagePayload = { channel: string; draft: string; recipients?: string[] };
export type MoneyPayload = { amountUsd: number; target: string };
export type ActionPayload = CodePayload | MessagePayload | MoneyPayload;
export type Checkpoint = {
    gitSha?: string;
    lastStep?: string;
    sessionId?: string; // harness session id (e.g. claude --session-id) - best-effort in-run resume
    agentPgid?: number; // process-group id of the agent subprocess, so the reaper can kill(-pgid)
    deployPgid?: number; // process-group id of the deployed app subprocess
    instanceId?: string; // executor instance that owns this run (single-executor invariant)
};

// ---- opportunity - a cheap scored candidate from a thought ----
export const opportunities = sqliteTable("opportunity", {
    id: pk(),
    thought: text("thought").notNull(),
    title: text("title").notNull(),
    thesis: text("thesis").notNull(),
    score: real("score"),
    status: text("status", { enum: ["candidate", "promoted", "killed"] })
        .notNull()
        .default("candidate"),
    createdAt: createdAt(),
});

// ---- company - the primitive: one committed bet = one product ----
export const companies = sqliteTable("company", {
    id: pk(),
    name: text("name").notNull(),
    gitRemote: text("git_remote"),
    thesis: text("thesis").notNull(),
    status: text("status", { enum: ["active", "paused", "archived"] })
        .notNull()
        .default("active"),
    domain: text("domain"),
    pricing: text("pricing", { mode: "json" }).$type<Pricing>(),
    channels: text("channels", { mode: "json" })
        .$type<Channel[]>()
        .notNull()
        .$defaultFn(() => []),
    metrics: text("metrics", { mode: "json" }).$type<Metrics>(),
    autopilot: text("autopilot", { enum: ["off", "on"] })
        .notNull()
        .default("off"),
    budgetCapUsd: real("budget_cap_usd"),
    lockedByRunId: text("locked_by_run_id"), // company is locked while a run is active
    createdAt: createdAt(),
});

// ---- action - the queue/backlog unit: code | message | money ----
export const actions = sqliteTable("action", {
    id: pk(),
    companyId: text("company_id")
        .notNull()
        .references(() => companies.id),
    type: text("type", { enum: ["code", "message", "money"] }).notNull(),
    title: text("title").notNull(),
    evidence: text("evidence", { mode: "json" }).$type<Record<string, unknown>>(),
    reversible: integer("reversible", { mode: "boolean" }).notNull().default(false),
    // approved = you clicked Approve; the executor's ship driver then promotes the
    // checkpoint sha and flips it to done. (Splitting approved/done keeps the ship
    // crash-durable - see src/engine/loop.ts ship driver.)
    status: text("status", {
        enum: ["queued", "running", "awaiting_approval", "approved", "done", "blocked"],
    })
        .notNull()
        .default("queued"),
    priority: real("priority").notNull().default(0), // impact × confidence ÷ effort
    dependsOn: text("depends_on", { mode: "json" }).$type<string[]>(),
    payload: text("payload", { mode: "json" }).$type<ActionPayload>().notNull(),
    createdAt: createdAt(),
});

// ---- run - invisible engine detail: one flat execution of a code action ----
export const runs = sqliteTable("run", {
    id: pk(),
    actionId: text("action_id")
        .notNull()
        .references(() => actions.id),
    companyId: text("company_id")
        .notNull()
        .references(() => companies.id),
    status: text("status", {
        enum: ["queued", "running", "awaiting_approval", "succeeded", "failed", "cancelled"],
    })
        .notNull()
        .default("queued"),
    attempt: integer("attempt").notNull().default(0),
    checkpoint: text("checkpoint", { mode: "json" }).$type<Checkpoint>(), // { gitSha, lastStep } - resume = replay
    costUsd: real("cost_usd").notNull().default(0),
    agentKind: text("agent_kind"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    error: text("error"),
    createdAt: createdAt(),
});

// ---- message - chat (companyId null = global) ----
export const messages = sqliteTable("message", {
    id: pk(),
    companyId: text("company_id").references(() => companies.id),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
});

// ---- draft — a "spin up a company" session (thought → candidates → spec+branding → commit) --
export const drafts = sqliteTable("draft", {
    id: pk(),
    thought: text("thought").notNull(),
    status: text("status", {
        enum: ["scouting", "proposals", "specing", "spec", "committed", "failed"],
    })
        .notNull()
        .default("scouting"),
    guardrails: text("guardrails", { mode: "json" }).$type<SpinGuardrails>(),
    data: text("data", { mode: "json" }).$type<DraftData>().notNull().default({}),
    companyId: text("company_id").references(() => companies.id),
    createdAt: createdAt(),
});

// ---- inferred row types ----
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ---- app_config — non-secret key-value settings (agent/guardrail/account/onboarding) ----
export const appConfig = sqliteTable(
    "app_config",
    {
        scope: text("scope").notNull().default("global"),
        key: text("key").notNull(),
        value: text("value", { mode: "json" }).$type<unknown>().notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (t) => ({ pk: primaryKey({ columns: [t.scope, t.key] }) }),
);

// ---- secret — server-only key store; client only ever sees last4 ----
export const secrets = sqliteTable(
    "secret",
    {
        scope: text("scope").notNull().default("global"),
        key: text("key").notNull(),
        value: text("value").notNull(),
        last4: text("last4"),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (t) => ({ pk: primaryKey({ columns: [t.scope, t.key] }) }),
);

export type AppConfigRow = typeof appConfig.$inferSelect;
export type SecretRow = typeof secrets.$inferSelect;
