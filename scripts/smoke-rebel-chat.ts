import { invokeLLM } from "../server/_core/llm";

async function run() {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxTokens: 1200,
    messages: [
      { role: "system", content: "Reply in Arabic with a brief greeting." },
      { role: "user", content: "اختبار اتصال Rebel AI" },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Rebel AI chat smoke test returned no text");
  console.log(`Rebel AI response received: ${content.slice(0, 120)}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
