import { eq } from "drizzle-orm";

import { rebelAccounts, rebelAnalyticsEvents } from "../drizzle/schema";
import { appRouter } from "../server/routers";
import { createRebelAccount, getDb, recordRebelAnalyticsEvent } from "../server/db";
import { createRebelSession, hashPassword } from "../server/rebel-auth";
import type { TrpcContext } from "../server/_core/context";

const context = (authorization?: string): TrpcContext => ({
  req: { headers: authorization ? { authorization } : {} } as unknown as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  user: null,
});

async function main() {
  const suffix = Date.now();
  let userId: number | undefined;
  let ownerId: number | undefined;
  try {
    const passwordHash = await hashPassword("Testing-Rebel-2026");
    const user = await createRebelAccount({ username: `analyticsuser${suffix}`, displayName: "حساب تحليلات", email: `analyticsuser${suffix}@example.test`, passwordHash });
    const owner = await createRebelAccount({ username: `analyticsowner${suffix}`, displayName: "مالك تحليلات", email: `analyticsowner${suffix}@example.test`, passwordHash, role: "owner" });
    userId = user.id;
    ownerId = owner.id;
    await recordRebelAnalyticsEvent({ accountId: user.id, provider: "gemini", model: "gemini-3.6-flash", outcome: "ok", latencyMs: 750 });
    await recordRebelAnalyticsEvent({ accountId: user.id, provider: "groq", model: "qwen/qwen3.6-27b", outcome: "rate_limited", fallbackUsed: true, latencyMs: 1200 });
    const ownerToken = createRebelSession({ accountId: owner.id, username: owner.username, displayName: owner.displayName, role: "owner" });
    const ownerAnalytics = await appRouter.createCaller(context(`Bearer ${ownerToken}`)).owner.analytics({ days: 7 });
    if (ownerAnalytics.requests < 2 || ownerAnalytics.activeAccounts < 1 || ownerAnalytics.providers.length < 2 || ownerAnalytics.fallbacks < 1) throw new Error("Owner analytics aggregation was incomplete");
    const userToken = createRebelSession({ accountId: user.id, username: user.username, displayName: user.displayName, role: "user" });
    let userWasDenied = false;
    try { await appRouter.createCaller(context(`Bearer ${userToken}`)).owner.analytics({ days: 7 }); } catch { userWasDenied = true; }
    if (!userWasDenied) throw new Error("Regular account accessed owner analytics");
    console.log("Owner analytics aggregation and regular-user access denial: passed");
  } finally {
    const database = await getDb();
    if (database) {
      for (const id of [userId, ownerId].filter((value): value is number => typeof value === "number")) {
        await database.delete(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, id));
        await database.delete(rebelAccounts).where(eq(rebelAccounts.id, id));
      }
    }
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
