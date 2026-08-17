export type ChatRole = "assistant" | "user";

export type MemorySeed = {
  title: string;
  content: string;
  category: "تفضيل" | "حقيقة" | "سياق" | "استنتاج";
};

export function compactMemories(memories: MemorySeed[], maxItems = 8) {
  return memories
    .slice(0, maxItems)
    .map((memory) => `- ${memory.category}: ${memory.title} — ${memory.content}`)
    .join("\n");
}

export function buildFallbackReply(message: string, memories: MemorySeed[]) {
  const context = compactMemories(memories, 2);
  const contextLine = context
    ? "أخذت بالاعتبار الذاكرة المرتبطة بك قبل صياغة الإجابة."
    : "لا توجد ذاكرة مرتبطة مباشرة بهذا الطلب بعد.";

  return {
    answer: `وصلت رسالتك: «${message}». ${contextLine} أستطيع تفكيك الموضوع إلى أدلة وافتراضات وخطوات عملية عند توفر اتصال التحليل.`,
    insight: "سأعرض دائماً ما هو مؤكد وما هو استنتاج وما يحتاج إلى مصدر إضافي.",
    confidence: 42,
    suggestedMemory: null,
  };
}

export function makeMemoryKey(title: string, content: string) {
  return `${title.trim().toLocaleLowerCase()}::${content.trim().toLocaleLowerCase()}`;
}
