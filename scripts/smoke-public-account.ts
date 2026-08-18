import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import { rebelAccounts, rebelDailyUsage, rebelProviderKeys } from "../drizzle/schema";
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
    const chat = await caller.assistant.chat({ message: "اكتب كلمة جاهز فقط.", memories: [], language: "ar-SA", model: "gemini-3.6-flash", gptId: "rebel-core" });
    if (!chat.answer.trim() || chat.usage.used !== 1) throw new Error("Authenticated chat or per-account quota increment check failed");
    const testKey = process.env.GEMINI_API_KEY;
    if (!testKey) throw new Error("Gemini key unavailable for encrypted personal-key smoke test");
    await caller.account.testAndSaveProviderKey({ provider: "gemini", apiKey: testKey });
    const storedKeyStatuses = await caller.account.providerKeyStatuses();
    if (!storedKeyStatuses.some((item) => item.provider === "gemini")) throw new Error("Encrypted personal provider key save check failed");
    await caller.account.deleteProviderKey({ provider: "gemini" });
    const afterDeleteStatuses = await caller.account.providerKeyStatuses();
    if (afterDeleteStatuses.some((item) => item.provider === "gemini")) throw new Error("Personal provider key deletion check failed");
    const secondRegistration = await appRouter.createCaller(context()).account.register({ username: secondUsername, displayName: "حساب اختبار ثانٍ", email: `${secondUsername}@example.test`, password: "Testing-Rebel-2026" });
    secondAccountId = secondRegistration.account.id;
    const secondUsage = await appRouter.createCaller(context(`Bearer ${secondRegistration.token}`)).account.usage();
    if (secondUsage.used !== 0) throw new Error("Daily usage was not isolated between accounts");
    console.log("Public account registration, signed session, authenticated chat, isolated usage, and encrypted personal-key lifecycle: passed");
  } finally {
    if (accountId || secondAccountId) {
      const database = await getDb();
      if (database) {
        for (const id of [accountId, secondAccountId].filter((value): value is number => typeof value === "number")) {
          await database.delete(rebelProviderKeys).where(eq(rebelProviderKeys.accountId, id));
          await database.delete(rebelDailyUsage).where(eq(rebelDailyUsage.accountId, id));
          await database.delete(rebelAccounts).where(eq(rebelAccounts.id, id));
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
