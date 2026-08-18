import { runFreeProvider } from "../server/free-providers";

async function run() {
  const answer = await runFreeProvider("gemini-3.6-flash", [
    { role: "system", content: "أجب بالعربية في فقرة قصيرة." },
    { role: "user", content: "اختبار اتصال Rebel AI" },
  ]);
  if (!answer.trim()) throw new Error("Rebel AI chat smoke test returned no text");
  console.log(`Rebel AI response received: ${answer.slice(0, 120)}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
