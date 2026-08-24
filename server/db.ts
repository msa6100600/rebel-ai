import { and, asc, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, rebelAccounts, rebelAnalyticsEvents, rebelConversationMessages, rebelConversations, rebelDailyUsage, rebelEvidenceItems, rebelMemoryItems, rebelMemorySettings, rebelProjectArtifacts, rebelProjects, rebelProviderKeys, rebelRateWindows, type RebelArtifactType, type RebelEvidenceKind, type RebelEvidenceStatus, type RebelMemoryCategory, type RebelProvider, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getRebelAccountByUsername(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelAccounts).where(eq(rebelAccounts.username, username)).limit(1);
  return rows[0];
}

export async function getRebelAccountByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelAccounts).where(eq(rebelAccounts.email, email)).limit(1);
  return rows[0];
}

export async function getRebelAccountByIdentity(identity: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelAccounts).where(or(eq(rebelAccounts.username, identity), eq(rebelAccounts.email, identity))).limit(1);
  return rows[0];
}

export async function getRebelAccountById(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelAccounts).where(eq(rebelAccounts.id, accountId)).limit(1);
  return rows[0];
}

export async function createRebelAccount(input: { username: string; displayName: string; email?: string; passwordHash: string; role?: "user" | "owner" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(rebelAccounts).values({
    username: input.username,
    displayName: input.displayName,
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role ?? "user",
  });
  const account = await getRebelAccountByUsername(input.username);
  if (!account) throw new Error("Account creation did not return an account");
  return account;
}

export async function updateRebelLastLogin(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(rebelAccounts).set({ lastLoginAt: new Date() }).where(eq(rebelAccounts.id, accountId));
}

export async function reserveFreeMessage(accountId: number, date: string, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select().from(rebelDailyUsage).where(and(eq(rebelDailyUsage.accountId, accountId), eq(rebelDailyUsage.usageDate, date))).limit(1);
  if (!current[0]) {
    await db.insert(rebelDailyUsage).values({ accountId, usageDate: date, requestCount: 1 });
    return { allowed: true, used: 1, limit };
  }
  if (current[0].requestCount >= limit) return { allowed: false, used: current[0].requestCount, limit };
  const next = current[0].requestCount + 1;
  await db.update(rebelDailyUsage).set({ requestCount: sql`${rebelDailyUsage.requestCount} + 1` }).where(eq(rebelDailyUsage.id, current[0].id));
  return { allowed: true, used: next, limit };
}

export async function getFreeUsage(accountId: number, date: string, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelDailyUsage).where(and(eq(rebelDailyUsage.accountId, accountId), eq(rebelDailyUsage.usageDate, date))).limit(1);
  const used = rows[0]?.requestCount ?? 0;
  return { used, remaining: Math.max(0, limit - used), limit };
}

export async function reserveRebelRateRequest(accountId: number, windowKey: string, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select().from(rebelRateWindows).where(and(eq(rebelRateWindows.accountId, accountId), eq(rebelRateWindows.windowKey, windowKey))).limit(1);
  if (!current[0]) {
    await db.insert(rebelRateWindows).values({ accountId, windowKey, requestCount: 1 });
    return { allowed: true, used: 1, limit, retryAfterSeconds: 60 };
  }
  if (current[0].requestCount >= limit) return { allowed: false, used: current[0].requestCount, limit, retryAfterSeconds: 60 };
  const next = current[0].requestCount + 1;
  await db.update(rebelRateWindows).set({ requestCount: sql`${rebelRateWindows.requestCount} + 1` }).where(eq(rebelRateWindows.id, current[0].id));
  return { allowed: true, used: next, limit, retryAfterSeconds: 60 };
}

export async function getRebelRateUsage(accountId: number, windowKey: string, limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db.select().from(rebelRateWindows).where(and(eq(rebelRateWindows.accountId, accountId), eq(rebelRateWindows.windowKey, windowKey))).limit(1);
  const used = current[0]?.requestCount ?? 0;
  return { used, remaining: Math.max(0, limit - used), limit };
}

export async function upsertRebelProviderKey(input: { accountId: number; provider: RebelProvider; encryptedKey: string; iv: string; authTag: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(rebelProviderKeys).values(input).onDuplicateKeyUpdate({
    set: { encryptedKey: input.encryptedKey, iv: input.iv, authTag: input.authTag },
  });
}

export async function getRebelProviderKey(accountId: number, provider: RebelProvider) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelProviderKeys).where(and(eq(rebelProviderKeys.accountId, accountId), eq(rebelProviderKeys.provider, provider))).limit(1);
  return rows[0];
}

export async function listRebelProviderKeyStatuses(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ provider: rebelProviderKeys.provider, updatedAt: rebelProviderKeys.updatedAt }).from(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, accountId));
  return rows;
}

export async function deleteRebelProviderKey(accountId: number, provider: RebelProvider) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rebelProviderKeys).where(and(eq(rebelProviderKeys.accountId, accountId), eq(rebelProviderKeys.provider, provider)));
}

export async function listRebelProjects(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(rebelProjects).where(eq(rebelProjects.accountId, accountId)).orderBy(desc(rebelProjects.updatedAt)).limit(100);
}

export async function getRebelProject(accountId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelProjects).where(and(eq(rebelProjects.accountId, accountId), eq(rebelProjects.id, projectId))).limit(1);
  return rows[0];
}

export async function createRebelProject(input: { accountId: number; name: string; description?: string; instructions?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const created = await db.insert(rebelProjects).values(input);
  const project = await getRebelProject(input.accountId, Number(created[0].insertId));
  if (!project) throw new Error("Project creation did not return a project");
  return project;
}

export async function updateRebelProject(input: { accountId: number; projectId: number; name?: string; description?: string | null; instructions?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { accountId, projectId, ...changes } = input;
  await db.update(rebelProjects).set({ ...changes, updatedAt: new Date() }).where(and(eq(rebelProjects.accountId, accountId), eq(rebelProjects.id, projectId)));
  return getRebelProject(accountId, projectId);
}

export async function deleteRebelProject(accountId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.delete(rebelEvidenceItems).where(and(eq(rebelEvidenceItems.accountId, accountId), eq(rebelEvidenceItems.projectId, projectId)));
    await tx.delete(rebelProjectArtifacts).where(and(eq(rebelProjectArtifacts.accountId, accountId), eq(rebelProjectArtifacts.projectId, projectId)));
    await tx.update(rebelConversations).set({ projectId: null }).where(and(eq(rebelConversations.accountId, accountId), eq(rebelConversations.projectId, projectId)));
    await tx.update(rebelMemoryItems).set({ projectId: null }).where(and(eq(rebelMemoryItems.accountId, accountId), eq(rebelMemoryItems.projectId, projectId)));
    await tx.delete(rebelProjects).where(and(eq(rebelProjects.accountId, accountId), eq(rebelProjects.id, projectId)));
  });
}

export async function listRebelEvidence(accountId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getRebelProject(accountId, projectId)) return [];
  return db.select().from(rebelEvidenceItems).where(and(eq(rebelEvidenceItems.accountId, accountId), eq(rebelEvidenceItems.projectId, projectId))).orderBy(desc(rebelEvidenceItems.updatedAt)).limit(200);
}

export async function listAllRebelEvidence(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(rebelEvidenceItems).where(eq(rebelEvidenceItems.accountId, accountId)).orderBy(desc(rebelEvidenceItems.updatedAt)).limit(500);
}

export async function createRebelEvidence(input: { accountId: number; projectId: number; kind: RebelEvidenceKind; title: string; content: string; confidence?: number; verificationStatus?: RebelEvidenceStatus; sourceMemoryId?: number; sourceConversationId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getRebelProject(input.accountId, input.projectId)) throw new Error("Evidence project not found for this account");
  const created = await db.insert(rebelEvidenceItems).values(input);
  const rows = await db.select().from(rebelEvidenceItems).where(and(eq(rebelEvidenceItems.id, Number(created[0].insertId)), eq(rebelEvidenceItems.accountId, input.accountId))).limit(1);
  if (!rows[0]) throw new Error("Evidence creation did not return an item");
  return rows[0];
}

export async function updateRebelEvidence(input: { accountId: number; evidenceId: number; kind?: RebelEvidenceKind; title?: string; content?: string; confidence?: number; verificationStatus?: RebelEvidenceStatus }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { accountId, evidenceId, ...changes } = input;
  await db.update(rebelEvidenceItems).set({ ...changes, updatedAt: new Date() }).where(and(eq(rebelEvidenceItems.id, evidenceId), eq(rebelEvidenceItems.accountId, accountId)));
  const rows = await db.select().from(rebelEvidenceItems).where(and(eq(rebelEvidenceItems.id, evidenceId), eq(rebelEvidenceItems.accountId, accountId))).limit(1);
  return rows[0];
}

export async function deleteRebelEvidence(accountId: number, evidenceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rebelEvidenceItems).where(and(eq(rebelEvidenceItems.id, evidenceId), eq(rebelEvidenceItems.accountId, accountId)));
}

export async function listRebelArtifacts(accountId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getRebelProject(accountId, projectId)) return [];
  return db.select().from(rebelProjectArtifacts).where(and(eq(rebelProjectArtifacts.accountId, accountId), eq(rebelProjectArtifacts.projectId, projectId))).orderBy(desc(rebelProjectArtifacts.updatedAt)).limit(200);
}

export async function listAllRebelArtifacts(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(rebelProjectArtifacts).where(eq(rebelProjectArtifacts.accountId, accountId)).orderBy(desc(rebelProjectArtifacts.updatedAt)).limit(500);
}

export async function createRebelArtifact(input: { accountId: number; projectId: number; type: RebelArtifactType; title: string; content: string; sourceConversationId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getRebelProject(input.accountId, input.projectId)) throw new Error("Artifact project not found for this account");
  const created = await db.insert(rebelProjectArtifacts).values(input);
  const rows = await db.select().from(rebelProjectArtifacts).where(and(eq(rebelProjectArtifacts.id, Number(created[0].insertId)), eq(rebelProjectArtifacts.accountId, input.accountId))).limit(1);
  if (!rows[0]) throw new Error("Artifact creation did not return an item");
  return rows[0];
}

export async function updateRebelArtifact(input: { accountId: number; artifactId: number; type?: RebelArtifactType; title?: string; content?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { accountId, artifactId, ...changes } = input;
  await db.update(rebelProjectArtifacts).set({ ...changes, updatedAt: new Date() }).where(and(eq(rebelProjectArtifacts.id, artifactId), eq(rebelProjectArtifacts.accountId, accountId)));
  const rows = await db.select().from(rebelProjectArtifacts).where(and(eq(rebelProjectArtifacts.id, artifactId), eq(rebelProjectArtifacts.accountId, accountId))).limit(1);
  return rows[0];
}

export async function deleteRebelArtifact(accountId: number, artifactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rebelProjectArtifacts).where(and(eq(rebelProjectArtifacts.id, artifactId), eq(rebelProjectArtifacts.accountId, accountId)));
}

export async function getRebelMemorySettings(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelMemorySettings).where(eq(rebelMemorySettings.accountId, accountId)).limit(1);
  return rows[0] ?? { accountId, enabled: true, autoSaveAllowed: false };
}

export async function updateRebelMemorySettings(input: { accountId: number; enabled?: boolean; autoSaveAllowed?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getRebelMemorySettings(input.accountId);
  const enabled = input.enabled ?? current.enabled;
  const autoSaveAllowed = input.autoSaveAllowed ?? current.autoSaveAllowed;
  await db.insert(rebelMemorySettings).values({ accountId: input.accountId, enabled, autoSaveAllowed }).onDuplicateKeyUpdate({ set: { enabled, autoSaveAllowed, updatedAt: new Date() } });
  return getRebelMemorySettings(input.accountId);
}

export async function createCloudConversation(input: { accountId: number; title: string; projectId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.projectId && !await getRebelProject(input.accountId, input.projectId)) throw new Error("Project not found for this account");
  const created = await db.insert(rebelConversations).values(input);
  const rows = await db.select().from(rebelConversations).where(and(eq(rebelConversations.id, Number(created[0].insertId)), eq(rebelConversations.accountId, input.accountId))).limit(1);
  if (!rows[0]) throw new Error("Conversation creation did not return a conversation");
  return rows[0];
}

export async function listCloudConversations(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(rebelConversations).where(eq(rebelConversations.accountId, accountId)).orderBy(desc(rebelConversations.updatedAt)).limit(100);
}

export async function getCloudConversation(accountId: number, conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(rebelConversations).where(and(eq(rebelConversations.id, conversationId), eq(rebelConversations.accountId, accountId))).limit(1);
  return rows[0];
}

export async function appendCloudMessage(input: { accountId: number; conversationId: number; role: "user" | "assistant"; content: string; model?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getCloudConversation(input.accountId, input.conversationId)) throw new Error("Conversation not found for this account");
  await db.insert(rebelConversationMessages).values(input);
  await db.update(rebelConversations).set({ updatedAt: new Date() }).where(and(eq(rebelConversations.id, input.conversationId), eq(rebelConversations.accountId, input.accountId)));
}

export async function listCloudMessages(accountId: number, conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!await getCloudConversation(accountId, conversationId)) return [];
  return db.select().from(rebelConversationMessages).where(and(eq(rebelConversationMessages.accountId, accountId), eq(rebelConversationMessages.conversationId, conversationId))).orderBy(asc(rebelConversationMessages.createdAt), asc(rebelConversationMessages.id));
}

export async function createCloudMemory(input: { accountId: number; category: RebelMemoryCategory; title: string; content: string; projectId?: number; importance?: number; expiresAt?: Date | null; sourceConversationId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.sourceConversationId && !await getCloudConversation(input.accountId, input.sourceConversationId)) throw new Error("Memory source conversation not found for this account");
  if (input.projectId && !await getRebelProject(input.accountId, input.projectId)) throw new Error("Memory project not found for this account");
  const created = await db.insert(rebelMemoryItems).values(input);
  const rows = await db.select().from(rebelMemoryItems).where(and(eq(rebelMemoryItems.id, Number(created[0].insertId)), eq(rebelMemoryItems.accountId, input.accountId))).limit(1);
  if (!rows[0]) throw new Error("Memory creation did not return a memory item");
  return rows[0];
}

export async function listCloudMemories(accountId: number, search?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = search?.trim();
  const where = normalized ? and(eq(rebelMemoryItems.accountId, accountId), or(like(rebelMemoryItems.title, `%${normalized}%`), like(rebelMemoryItems.content, `%${normalized}%`))) : eq(rebelMemoryItems.accountId, accountId);
  return db.select().from(rebelMemoryItems).where(where).orderBy(desc(rebelMemoryItems.updatedAt)).limit(100);
}

export async function deleteCloudMemory(accountId: number, memoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rebelMemoryItems).where(and(eq(rebelMemoryItems.id, memoryId), eq(rebelMemoryItems.accountId, accountId)));
}

export async function updateCloudMemory(input: { accountId: number; memoryId: number; category?: RebelMemoryCategory; title?: string; content?: string; projectId?: number | null; importance?: number; expiresAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.projectId && !await getRebelProject(input.accountId, input.projectId)) throw new Error("Memory project not found for this account");
  const { accountId, memoryId, ...changes } = input;
  await db.update(rebelMemoryItems).set({ ...changes, updatedAt: new Date() }).where(and(eq(rebelMemoryItems.accountId, accountId), eq(rebelMemoryItems.id, memoryId)));
  const rows = await db.select().from(rebelMemoryItems).where(and(eq(rebelMemoryItems.accountId, accountId), eq(rebelMemoryItems.id, memoryId))).limit(1);
  return rows[0];
}

type RebelAnalyticsOutcome = "ok" | "daily_limit" | "rate_limited" | "provider_error" | "fallback_error";

export async function recordRebelAnalyticsEvent(input: { accountId: number; provider?: string; model?: string; outcome: RebelAnalyticsOutcome; fallbackUsed?: boolean; latencyMs?: number; contextLatencyMs?: number; providerLatencyMs?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(rebelAnalyticsEvents).values({
    accountId: input.accountId,
    provider: input.provider,
    model: input.model,
    outcome: input.outcome,
    fallbackUsed: input.fallbackUsed ? 1 : 0,
    latencyMs: input.latencyMs,
    contextLatencyMs: input.contextLatencyMs,
    providerLatencyMs: input.providerLatencyMs,
  });
}

const asNumber = (value: unknown) => Number(value ?? 0);

export async function getOwnerAnalytics(days: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const safeDays = Math.max(1, Math.min(30, Math.floor(days)));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const filter = gte(rebelAnalyticsEvents.occurredAt, since);
  const analyticsDay = sql<string>`DATE(${rebelAnalyticsEvents.occurredAt})`.as("analyticsDay");
  // Keep these reads sequential: the project uses a shared lightweight DB
  // connection, and a parallel fan-out can stall the analytics screen.
  const summaryRows = await db.select({ requests: sql<number>`COUNT(*)`, activeAccounts: sql<number>`COUNT(DISTINCT ${rebelAnalyticsEvents.accountId})`, averageLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.latencyMs}))`, averageContextLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.contextLatencyMs}))`, averageProviderLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.providerLatencyMs}))`, fallbacks: sql<number>`SUM(${rebelAnalyticsEvents.fallbackUsed})` }).from(rebelAnalyticsEvents).where(filter);
  const totalAccountRows = await db.select({ accounts: sql<number>`COUNT(*)` }).from(rebelAccounts);
  const outcomes = await db.select({ outcome: rebelAnalyticsEvents.outcome, count: sql<number>`COUNT(*)` }).from(rebelAnalyticsEvents).where(filter).groupBy(rebelAnalyticsEvents.outcome);
  const providers = await db.select({ provider: rebelAnalyticsEvents.provider, count: sql<number>`COUNT(*)`, averageLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.latencyMs}))` }).from(rebelAnalyticsEvents).where(filter).groupBy(rebelAnalyticsEvents.provider);
  const daily = await db.select({ date: analyticsDay, requests: sql<number>`COUNT(*)`, activeAccounts: sql<number>`COUNT(DISTINCT ${rebelAnalyticsEvents.accountId})` }).from(rebelAnalyticsEvents).where(filter).groupBy(analyticsDay).orderBy(analyticsDay);
  const summary = summaryRows[0];
  return {
    days: safeDays,
    totalAccounts: asNumber(totalAccountRows[0]?.accounts),
    requests: asNumber(summary?.requests),
    activeAccounts: asNumber(summary?.activeAccounts),
    averageLatencyMs: asNumber(summary?.averageLatencyMs),
    averageContextLatencyMs: asNumber(summary?.averageContextLatencyMs),
    averageProviderLatencyMs: asNumber(summary?.averageProviderLatencyMs),
    fallbacks: asNumber(summary?.fallbacks),
    outcomes: outcomes.map((item) => ({ outcome: item.outcome, count: asNumber(item.count) })),
    providers: providers.map((item) => ({ provider: item.provider ?? "unknown", count: asNumber(item.count), averageLatencyMs: asNumber(item.averageLatencyMs) })),
    daily: daily.map((item) => ({ date: item.date, requests: asNumber(item.requests), activeAccounts: asNumber(item.activeAccounts) })),
  };
}

export async function exportRebelAccountData(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // This database connection is intentionally shared by the lightweight server.
  // Sequential reads avoid a driver-level queue stall that can occur when this
  // export fans out multiple queries through the same connection at once.
  const account = await getRebelAccountById(accountId);
  const projects = await listRebelProjects(accountId);
  const conversations = await listCloudConversations(accountId);
  const messages = await db.select().from(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, accountId)).orderBy(asc(rebelConversationMessages.createdAt), asc(rebelConversationMessages.id));
  const memories = await listCloudMemories(accountId);
  const evidence = await listAllRebelEvidence(accountId);
  const artifacts = await listAllRebelArtifacts(accountId);
  const memorySettings = await getRebelMemorySettings(accountId);
  const providerKeyStatuses = await listRebelProviderKeyStatuses(accountId);
  if (!account) throw new Error("Account not found");
  const { passwordHash: _passwordHash, ...safeAccount } = account;
  return {
    format: "rebel-ai-account-export-v1",
    exportedAt: new Date().toISOString(),
    account: safeAccount,
    projects,
    conversations,
    messages,
    memories,
    evidence,
    artifacts,
    memorySettings,
    providerKeyStatuses,
    exclusions: ["passwordHash", "providerApiKeyValues", "sessionTokens", "analyticsEvents"],
  };
}

export async function deleteRebelAccountAndData(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.delete(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, accountId));
    await tx.delete(rebelEvidenceItems).where(eq(rebelEvidenceItems.accountId, accountId));
    await tx.delete(rebelProjectArtifacts).where(eq(rebelProjectArtifacts.accountId, accountId));
    await tx.delete(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, accountId));
    await tx.delete(rebelConversations).where(eq(rebelConversations.accountId, accountId));
    await tx.delete(rebelMemoryItems).where(eq(rebelMemoryItems.accountId, accountId));
    await tx.delete(rebelMemorySettings).where(eq(rebelMemorySettings.accountId, accountId));
    await tx.delete(rebelProjects).where(eq(rebelProjects.accountId, accountId));
    await tx.delete(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, accountId));
    await tx.delete(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, accountId));
    await tx.delete(rebelRateWindows).where(eq(rebelRateWindows.accountId, accountId));
    await tx.delete(rebelAccounts).where(eq(rebelAccounts.id, accountId));
  });
}
