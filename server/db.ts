import { and, asc, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, rebelAccounts, rebelAnalyticsEvents, rebelConversationMessages, rebelConversations, rebelDailyUsage, rebelMemoryItems, rebelProviderKeys, rebelRateWindows, type RebelMemoryCategory, type RebelProvider, users } from "../drizzle/schema";
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

export async function createCloudConversation(accountId: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const created = await db.insert(rebelConversations).values({ accountId, title });
  const rows = await db.select().from(rebelConversations).where(and(eq(rebelConversations.id, Number(created[0].insertId)), eq(rebelConversations.accountId, accountId))).limit(1);
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

export async function createCloudMemory(input: { accountId: number; category: RebelMemoryCategory; title: string; content: string; sourceConversationId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.sourceConversationId && !await getCloudConversation(input.accountId, input.sourceConversationId)) throw new Error("Memory source conversation not found for this account");
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

type RebelAnalyticsOutcome = "ok" | "daily_limit" | "rate_limited" | "provider_error" | "fallback_error";

export async function recordRebelAnalyticsEvent(input: { accountId: number; provider?: string; model?: string; outcome: RebelAnalyticsOutcome; fallbackUsed?: boolean; latencyMs?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(rebelAnalyticsEvents).values({
    accountId: input.accountId,
    provider: input.provider,
    model: input.model,
    outcome: input.outcome,
    fallbackUsed: input.fallbackUsed ? 1 : 0,
    latencyMs: input.latencyMs,
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
  const [summaryRows, totalAccountRows, outcomes, providers, daily] = await Promise.all([
    db.select({ requests: sql<number>`COUNT(*)`, activeAccounts: sql<number>`COUNT(DISTINCT ${rebelAnalyticsEvents.accountId})`, averageLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.latencyMs}))`, fallbacks: sql<number>`SUM(${rebelAnalyticsEvents.fallbackUsed})` }).from(rebelAnalyticsEvents).where(filter),
    db.select({ accounts: sql<number>`COUNT(*)` }).from(rebelAccounts),
    db.select({ outcome: rebelAnalyticsEvents.outcome, count: sql<number>`COUNT(*)` }).from(rebelAnalyticsEvents).where(filter).groupBy(rebelAnalyticsEvents.outcome),
    db.select({ provider: rebelAnalyticsEvents.provider, count: sql<number>`COUNT(*)`, averageLatencyMs: sql<number>`ROUND(AVG(${rebelAnalyticsEvents.latencyMs}))` }).from(rebelAnalyticsEvents).where(filter).groupBy(rebelAnalyticsEvents.provider),
    db.select({ date: analyticsDay, requests: sql<number>`COUNT(*)`, activeAccounts: sql<number>`COUNT(DISTINCT ${rebelAnalyticsEvents.accountId})` }).from(rebelAnalyticsEvents).where(filter).groupBy(analyticsDay).orderBy(analyticsDay),
  ]);
  const summary = summaryRows[0];
  return {
    days: safeDays,
    totalAccounts: asNumber(totalAccountRows[0]?.accounts),
    requests: asNumber(summary?.requests),
    activeAccounts: asNumber(summary?.activeAccounts),
    averageLatencyMs: asNumber(summary?.averageLatencyMs),
    fallbacks: asNumber(summary?.fallbacks),
    outcomes: outcomes.map((item) => ({ outcome: item.outcome, count: asNumber(item.count) })),
    providers: providers.map((item) => ({ provider: item.provider ?? "unknown", count: asNumber(item.count), averageLatencyMs: asNumber(item.averageLatencyMs) })),
    daily: daily.map((item) => ({ date: item.date, requests: asNumber(item.requests), activeAccounts: asNumber(item.activeAccounts) })),
  };
}

export async function deleteRebelAccountAndData(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.delete(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, accountId));
    await tx.delete(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, accountId));
    await tx.delete(rebelConversations).where(eq(rebelConversations.accountId, accountId));
    await tx.delete(rebelMemoryItems).where(eq(rebelMemoryItems.accountId, accountId));
    await tx.delete(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, accountId));
    await tx.delete(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, accountId));
    await tx.delete(rebelRateWindows).where(eq(rebelRateWindows.accountId, accountId));
    await tx.delete(rebelAccounts).where(eq(rebelAccounts.id, accountId));
  });
}
