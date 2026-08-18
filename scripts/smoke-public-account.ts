import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb, getRebelRateUsage, reserveRebelRateRequest } from "../server/db";
import { rebelAccounts, rebelAnalyticsEvents, rebelConversationMessages, rebelConversations, rebelDailyUsage, rebelMemoryItems, rebelProviderKeys, rebelRateWindows } from "../drizzle/schema";
import type { TrpcContext } from "../server/_core/context";

const context = (authorization?: string): TrpcContext => ({
  req: { headers: authorization ? { authorization } : {} } as unknown as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  user: null,
});

async function main() {
  const username = `rebelcheck${Date.now()}`;
  const secondUsername = `${username}b`;
  let accountId: number | undefined;
  let secondAccountId: number | undefined;
  try {
    const registration = await appRouter.createCaller(context()).account.register({ username, displayName: "حساب اختبار", email: `${username}@example.test`, password: "Testing-Rebel-2026" });
    accountId = registration.account.id;
    const caller = appRouter.createCaller(context(`Bearer ${registration.token}`));
    const profile = await caller.account.me();
    const usage = await caller.account.usage();
    if (profile.account.id !== accountId || usage.used !== 0 || usage.remaining !== usage.limit) throw new Error("Public account profile or usage isolation check failed");
    const testRateWindow = `test-${Date.now()}`;
    const rateOne = await reserveRebelRateRequest(accountId, testRateWindow, 2);
    const rateTwo = await reserveRebelRateRequest(accountId, testRateWindow, 2);
    const rateThree = await reserveRebelRateRequest(accountId, testRateWindow, 2);
    const rateUsage = await getRebelRateUsage(accountId, testRateWindow, 2);
    if (!rateOne.allowed || !rateTwo.allowed || rateThree.allowed || rateUsage.used !== 2) throw new Error("Per-account rate limit check failed");
    const chat = await caller.assistant.chat({ message: "اكتب كلمة جاهز فقط.", memories: [], language: "ar-SA", model: "gemini-3.6-flash", gptId: "rebel-core" });
    if (!chat.answer.trim() || chat.usage.used !== 1) throw new Error("Authenticated chat or per-account quota increment check failed");
    const analyticsDatabase = await getDb();
    if (!analyticsDatabase || (await analyticsDatabase.select().from(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, accountId))).length < 1) throw new Error("Chat route did not record an aggregated analytics event");
    const conversationMessages = await caller.cloud.conversations.messages({ conversationId: chat.conversationId });
    if (conversationMessages.length < 2 || conversationMessages[0].content !== "اكتب كلمة جاهز فقط.") throw new Error("Cloud conversation did not persist the user and assistant messages");
    if (process.env.REBEL_RATE_LIMIT_PER_MINUTE === "1") {
      const configuredRate = await caller.account.me();
      if (configuredRate.rate.limit !== 1) throw new Error(`Chat route did not load configured rate limit: ${configuredRate.rate.limit}`);
      const rateLimitedChat = await caller.assistant.chat({ message: "يجب أن يمنعني الحد الزمني.", conversationId: chat.conversationId, memories: [], language: "ar-SA", model: "gemini-3.6-flash", gptId: "rebel-core" });
      if (rateLimitedChat.status !== "rate_limited") throw new Error(`Chat route did not enforce the configured rate limit: ${rateLimitedChat.status}`);
    }
    const memory = await caller.cloud.memories.create({ category: "preference", title: "تفضيل الاختبار", content: "يفضل المستخدم إجابات عربية موجزة." });
    const cloudMemories = await caller.cloud.memories.list({ search: "موجزة" });
    if (!cloudMemories.some((item) => item.id === memory.id)) throw new Error("Cloud memory search or persistence check failed");
    const restoredCaller = appRouter.createCaller(context(`Bearer ${registration.token}`));
    const restoredMessages = await restoredCaller.cloud.conversations.messages({ conversationId: chat.conversationId });
    const restoredMemories = await restoredCaller.cloud.memories.list();
    if (restoredMessages.length < conversationMessages.length || !restoredMemories.some((item) => item.id === memory.id)) throw new Error("Cloud data was not restored from a separate signed session");
    if (process.env.RUN_PERSONAL_KEY_SMOKE === "true") {
      const testKey = process.env.GEMINI_API_KEY;
      if (!testKey) throw new Error("Gemini key unavailable for encrypted personal-key smoke test");
      await caller.account.testAndSaveProviderKey({ provider: "gemini", apiKey: testKey });
      const storedKeyStatuses = await caller.account.providerKeyStatuses();
      if (!storedKeyStatuses.some((item) => item.provider === "gemini")) throw new Error("Encrypted personal provider key save check failed");
      await caller.account.deleteProviderKey({ provider: "gemini" });
      const afterDeleteStatuses = await caller.account.providerKeyStatuses();
      if (afterDeleteStatuses.some((item) => item.provider === "gemini")) throw new Error("Personal provider key deletion check failed");
    }
    const secondRegistration = await appRouter.createCaller(context()).account.register({ username: secondUsername, displayName: "حساب اختبار ثانٍ", email: `${secondUsername}@example.test`, password: "Testing-Rebel-2026" });
    secondAccountId = secondRegistration.account.id;
    const secondCaller = appRouter.createCaller(context(`Bearer ${secondRegistration.token}`));
    const secondUsage = await secondCaller.account.usage();
    if (secondUsage.used !== 0) throw new Error("Daily usage was not isolated between accounts");
    if ((await secondCaller.cloud.memories.list()).length !== 0) throw new Error("Cloud memories leaked to the second account");
    await secondCaller.cloud.conversations.messages({ conversationId: chat.conversationId }).then(() => { throw new Error("Cloud conversation leaked to the second account"); }).catch((error) => {
      if (error.message === "Cloud conversation leaked to the second account") throw error;
    });
    const deletedAccountId = accountId;
    await caller.account.deleteAccount({ password: "Testing-Rebel-2026", confirmation: "DELETE" });
    const database = await getDb();
    if (!database) throw new Error("Database unavailable while checking account deletion");
    const remaining = await Promise.all([
      database.select().from(rebelAccounts).where(eq(rebelAccounts.id, deletedAccountId)),
      database.select().from(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, deletedAccountId)),
      database.select().from(rebelConversations).where(eq(rebelConversations.accountId, deletedAccountId)),
      database.select().from(rebelMemoryItems).where(eq(rebelMemoryItems.accountId, deletedAccountId)),
      database.select().from(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, deletedAccountId)),
      database.select().from(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, deletedAccountId)),
      database.select().from(rebelRateWindows).where(eq(rebelRateWindows.accountId, deletedAccountId)),
      database.select().from(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, deletedAccountId)),
    ]);
    if (remaining.some((rows) => rows.length > 0)) throw new Error("Account deletion left related cloud data behind");
    accountId = undefined;
    console.log("Public account registration, cloud history and memory restoration, isolation, encrypted key lifecycle, and complete account deletion: passed");
  } finally {
    if (accountId || secondAccountId) {
      const database = await getDb();
      if (database) {
        for (const id of [accountId, secondAccountId].filter((value): value is number => typeof value === "number")) {
          await database.delete(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, id));
          await database.delete(rebelConversations).where(eq(rebelConversations.accountId, id));
          await database.delete(rebelMemoryItems).where(eq(rebelMemoryItems.accountId, id));
          await database.delete(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, id));
          await database.delete(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, id));
          await database.delete(rebelRateWindows).where(eq(rebelRateWindows.accountId, id));
          await database.delete(rebelAccounts).where(eq(rebelAccounts.id, id));
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
