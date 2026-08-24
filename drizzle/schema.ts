import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const rebelAccounts = mysqlTable("rebel_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  displayName: varchar("displayName", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "owner"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt").defaultNow().notNull(),
});

export const rebelDailyUsage = mysqlTable("rebel_daily_usage", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  usageDate: varchar("usageDate", { length: 10 }).notNull(),
  requestCount: int("requestCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [unique("rebel_usage_account_day_unique").on(table.accountId, table.usageDate)]);

export const rebelProviderKeys = mysqlTable("rebel_provider_keys", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  provider: mysqlEnum("provider", ["gemini", "groq", "mistral"]).notNull(),
  encryptedKey: text("encryptedKey").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("authTag", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [unique("rebel_key_account_provider_unique").on(table.accountId, table.provider)]);

export const rebelProjects = mysqlTable("rebel_projects", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rebel_project_account_updated_idx").on(table.accountId, table.updatedAt)]);

export const rebelMemorySettings = mysqlTable("rebel_memory_settings", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  autoSaveAllowed: boolean("autoSaveAllowed").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [unique("rebel_memory_settings_account_unique").on(table.accountId)]);

export const rebelConversations = mysqlTable("rebel_conversations", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  projectId: int("projectId"),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rebel_conversation_account_updated_idx").on(table.accountId, table.updatedAt)]);

export const rebelConversationMessages = mysqlTable("rebel_conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  model: varchar("model", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("rebel_message_account_conversation_idx").on(table.accountId, table.conversationId, table.createdAt)]);

export const rebelMemoryItems = mysqlTable("rebel_memory_items", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  projectId: int("projectId"),
  category: mysqlEnum("category", ["profile", "preference", "goal", "project", "decision", "temporary"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  importance: int("importance").default(50).notNull(),
  expiresAt: timestamp("expiresAt"),
  sourceConversationId: int("sourceConversationId"),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rebel_memory_account_category_idx").on(table.accountId, table.category), index("rebel_memory_account_project_idx").on(table.accountId, table.projectId), index("rebel_memory_account_updated_idx").on(table.accountId, table.updatedAt)]);

export const rebelEvidenceItems = mysqlTable("rebel_evidence_items", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  projectId: int("projectId").notNull(),
  kind: mysqlEnum("kind", ["claim", "evidence", "assumption", "decision"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  confidence: int("confidence").default(50).notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["unverified", "reviewing", "verified", "rejected"]).default("unverified").notNull(),
  sourceMemoryId: int("sourceMemoryId"),
  sourceConversationId: int("sourceConversationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rebel_evidence_account_project_updated_idx").on(table.accountId, table.projectId, table.updatedAt), index("rebel_evidence_account_status_idx").on(table.accountId, table.verificationStatus)]);

export const rebelProjectArtifacts = mysqlTable("rebel_project_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  projectId: int("projectId").notNull(),
  type: mysqlEnum("type", ["document", "plan", "table", "decision"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  content: text("content").notNull(),
  sourceConversationId: int("sourceConversationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("rebel_artifact_account_project_updated_idx").on(table.accountId, table.projectId, table.updatedAt), index("rebel_artifact_account_type_idx").on(table.accountId, table.type)]);

export const rebelRateWindows = mysqlTable("rebel_rate_windows", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  windowKey: varchar("windowKey", { length: 20 }).notNull(),
  requestCount: int("requestCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [unique("rebel_rate_account_window_unique").on(table.accountId, table.windowKey)]);

export const rebelAnalyticsEvents = mysqlTable("rebel_analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  provider: varchar("provider", { length: 32 }),
  model: varchar("model", { length: 128 }),
  outcome: mysqlEnum("outcome", ["ok", "daily_limit", "rate_limited", "provider_error", "fallback_error"]).notNull(),
  fallbackUsed: int("fallbackUsed").default(0).notNull(),
  latencyMs: int("latencyMs"),
  contextLatencyMs: int("contextLatencyMs"),
  providerLatencyMs: int("providerLatencyMs"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => [index("rebel_analytics_occurred_idx").on(table.occurredAt), index("rebel_analytics_account_occurred_idx").on(table.accountId, table.occurredAt), index("rebel_analytics_provider_occurred_idx").on(table.provider, table.occurredAt)]);

export type RebelAccount = typeof rebelAccounts.$inferSelect;
export type RebelProvider = "gemini" | "groq" | "mistral";
export type RebelMemoryCategory = "profile" | "preference" | "goal" | "project" | "decision" | "temporary";
export type RebelProject = typeof rebelProjects.$inferSelect;
export type RebelEvidenceKind = "claim" | "evidence" | "assumption" | "decision";
export type RebelEvidenceStatus = "unverified" | "reviewing" | "verified" | "rejected";
export type RebelArtifactType = "document" | "plan" | "table" | "decision";
