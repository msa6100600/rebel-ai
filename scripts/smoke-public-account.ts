import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb, getRebelRateUsage, reserveRebelRateRequest } from "../server/db";
import { rebelAccounts, rebelAnalyticsEvents, rebelConversationMessages, rebelConversations, rebelDailyUsage, rebelEvidenceItems, rebelMemoryItems, rebelMemorySettings, rebelProjectArtifacts, rebelProjects, rebelProviderKeys, rebelRateWindows } from "../drizzle/schema";
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
    console.log("[smoke] إنشاء الحساب الأول");
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
    console.log("[smoke] اختبار المحادثة مع النموذج");
    const chat = await caller.assistant.chat({ message: "اكتب كلمة جاهز فقط.", memories: [], language: "ar-SA", model: "gemini-3.6-flash", gptId: "rebel-core" });
    if (!chat.answer.trim() || !chat.conversationId || chat.usage.used !== 1) throw new Error("Authenticated chat or per-account quota increment check failed");
    const cloudConversationId = chat.conversationId;
    console.log("[smoke] اختبار المشروع والذاكرة والتصدير");
    const project = await caller.cloud.projects.create({ name: "مشروع الاختبار", description: "عزل وربط الذاكرة", instructions: "أجب بالعربية بإيجاز." });
    if (!(await caller.cloud.projects.list()).some((item) => item.id === project.id)) throw new Error("Project was not created for the account");
    const evidence = await caller.cloud.evidence.create({ projectId: project.id, kind: "evidence", title: "دليل اختبار", content: "هذه معلومة اختبارية للمشروع.", confidence: 80, verificationStatus: "reviewing" });
    const evidenceItems = await caller.cloud.evidence.list({ projectId: project.id });
    if (!evidenceItems.some((item) => item.id === evidence.id)) throw new Error("Evidence item was not created for the project");
    const revisedEvidence = await caller.cloud.evidence.update({ evidenceId: evidence.id, verificationStatus: "verified", confidence: 90 });
    if (revisedEvidence.verificationStatus !== "verified" || revisedEvidence.confidence !== 90) throw new Error("Evidence item update failed");
    const artifact = await caller.cloud.artifacts.create({ projectId: project.id, type: "plan", title: "خطة اختبار", content: "خطوة أولى\nخطوة ثانية" });
    const artifacts = await caller.cloud.artifacts.list({ projectId: project.id });
    if (!artifacts.some((item) => item.id === artifact.id)) throw new Error("Project artifact was not created");
    const revisedArtifact = await caller.cloud.artifacts.update({ artifactId: artifact.id, title: "خطة اختبار معدلة" });
    if (revisedArtifact.title !== "خطة اختبار معدلة") throw new Error("Project artifact update failed");
    console.log("[smoke] فحص التحليلات وسجل المحادثة");
    const analyticsDatabase = await getDb();
    if (!analyticsDatabase || (await analyticsDatabase.select().from(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, accountId))).length < 1) throw new Error("Chat route did not record an aggregated analytics event");
    const conversationMessages = await caller.cloud.conversations.messages({ conversationId: cloudConversationId });
    if (conversationMessages.length < 2 || conversationMessages[0].content !== "اكتب كلمة جاهز فقط.") throw new Error("Cloud conversation did not persist the user and assistant messages");
    if (process.env.REBEL_RATE_LIMIT_PER_MINUTE === "1") {
      const configuredRate = await caller.account.me();
      if (configuredRate.rate.limit !== 1) throw new Error(`Chat route did not load configured rate limit: ${configuredRate.rate.limit}`);
      const rateLimitedChat = await caller.assistant.chat({ message: "يجب أن يمنعني الحد الزمني.", conversationId: cloudConversationId, memories: [], language: "ar-SA", model: "gemini-3.6-flash", gptId: "rebel-core" });
      if (rateLimitedChat.status !== "rate_limited") throw new Error(`Chat route did not enforce the configured rate limit: ${rateLimitedChat.status}`);
    }
    console.log("[smoke] إنشاء الذاكرة والبحث فيها");
    const memory = await caller.cloud.memories.create({ category: "preference", title: "تفضيل الاختبار", content: "يفضل المستخدم إجابات عربية موجزة.", projectId: project.id, importance: 75 });
    const cloudMemories = await caller.cloud.memories.list({ search: "موجزة" });
    if (!cloudMemories.some((item) => item.id === memory.id)) throw new Error("Cloud memory search or persistence check failed");
    console.log("[smoke] تحديث إعدادات الذاكرة وتصدير البيانات");
    const memorySettings = await caller.cloud.memories.updateSettings({ enabled: false });
    if (memorySettings.enabled) throw new Error("Memory settings update failed");
    console.log("[smoke] تصدير البيانات");
    const exported = await caller.account.exportData();
    if (!exported.projects.some((item) => item.id === project.id) || !exported.memories.some((item) => item.id === memory.id) || !exported.evidence.some((item) => item.id === evidence.id) || !exported.artifacts.some((item) => item.id === artifact.id) || "passwordHash" in exported.account) throw new Error("Account export did not include safe owned data");
    console.log("[smoke] اختبار الاستعادة من جلسة ثانية");
    const restoredCaller = appRouter.createCaller(context(`Bearer ${registration.token}`));
    const restoredMessages = await restoredCaller.cloud.conversations.messages({ conversationId: cloudConversationId });
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
    console.log("[smoke] اختبار العزل بين الحسابات والحذف الشامل");
    const secondRegistration = await appRouter.createCaller(context()).account.register({ username: secondUsername, displayName: "حساب اختبار ثانٍ", email: `${secondUsername}@example.test`, password: "Testing-Rebel-2026" });
    secondAccountId = secondRegistration.account.id;
    const secondCaller = appRouter.createCaller(context(`Bearer ${secondRegistration.token}`));
    console.log("[smoke] فحص عزل الحصة والذاكرة");
    const secondUsage = await secondCaller.account.usage();
    if (secondUsage.used !== 0) throw new Error("Daily usage was not isolated between accounts");
    if ((await secondCaller.cloud.memories.list()).length !== 0) throw new Error("Cloud memories leaked to the second account");
    await secondCaller.cloud.evidence.list({ projectId: project.id }).then(() => { throw new Error("Evidence items leaked to the second account"); }).catch((error) => {
      if (error.message === "Evidence items leaked to the second account") throw error;
    });
    await secondCaller.cloud.artifacts.list({ projectId: project.id }).then(() => { throw new Error("Project artifacts leaked to the second account"); }).catch((error) => {
      if (error.message === "Project artifacts leaked to the second account") throw error;
    });
    await secondCaller.cloud.conversations.messages({ conversationId: cloudConversationId }).then(() => { throw new Error("Cloud conversation leaked to the second account"); }).catch((error) => {
      if (error.message === "Cloud conversation leaked to the second account") throw error;
    });
    console.log("[smoke] حذف الحساب الأول");
    const deletedAccountId = accountId;
    await caller.account.deleteAccount({ password: "Testing-Rebel-2026", confirmation: "DELETE" });
    console.log("[smoke] فحص بقايا البيانات بعد الحذف");
    const database = await getDb();
    if (!database) throw new Error("Database unavailable while checking account deletion");
    const remaining = [];
    for (const query of [
      database.select().from(rebelAccounts).where(eq(rebelAccounts.id, deletedAccountId)),
      database.select().from(rebelConversationMessages).where(eq(rebelConversationMessages.accountId, deletedAccountId)),
      database.select().from(rebelConversations).where(eq(rebelConversations.accountId, deletedAccountId)),
      database.select().from(rebelMemoryItems).where(eq(rebelMemoryItems.accountId, deletedAccountId)),
      database.select().from(rebelEvidenceItems).where(eq(rebelEvidenceItems.accountId, deletedAccountId)),
      database.select().from(rebelProjectArtifacts).where(eq(rebelProjectArtifacts.accountId, deletedAccountId)),
      database.select().from(rebelMemorySettings).where(eq(rebelMemorySettings.accountId, deletedAccountId)),
      database.select().from(rebelProjects).where(eq(rebelProjects.accountId, deletedAccountId)),
      database.select().from(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, deletedAccountId)),
      database.select().from(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, deletedAccountId)),
      database.select().from(rebelRateWindows).where(eq(rebelRateWindows.accountId, deletedAccountId)),
      database.select().from(rebelAnalyticsEvents).where(eq(rebelAnalyticsEvents.accountId, deletedAccountId)),
    ]) remaining.push(await query);
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
          await database.delete(rebelEvidenceItems).where(eq(rebelEvidenceItems.accountId, id));
          await database.delete(rebelProjectArtifacts).where(eq(rebelProjectArtifacts.accountId, id));
          await database.delete(rebelMemorySettings).where(eq(rebelMemorySettings.accountId, id));
          await database.delete(rebelProjects).where(eq(rebelProjects.accountId, id));
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
