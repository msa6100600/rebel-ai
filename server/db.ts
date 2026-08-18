import { and, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, rebelAccounts, rebelDailyUsage, rebelProviderKeys, type RebelProvider, users } from "../drizzle/schema";
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
