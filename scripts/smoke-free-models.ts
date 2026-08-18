import { FREE_MODELS, FreeProviderError, runFreeProvider } from "../server/free-providers";

async function main() {
  const messages = [
    { role: "system" as const, content: "أجب بالعربية الفصحى في جملة قصيرة فقط." },
    { role: "user" as const, content: "اكتب تحية عربية قصيرة تؤكد أنك تعمل." },
  ];
  let failures = 0;
  for (const model of FREE_MODELS) {
    try {
      const answer = await runFreeProvider(model, messages);
      if (answer.trim().length < 2) throw new Error(`${model} returned an empty response`);
      console.log(`${model}: ${answer.slice(0, 90)}`);
    } catch (error) {
      failures += 1;
      if (error instanceof FreeProviderError) console.error(`${model}: ${error.kind} | ${error.provider} | HTTP ${error.statusCode ?? "غير معروف"} | ${error.diagnostic ?? "لا توجد تفاصيل"}`);
      else console.error(`${model}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (failures) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
