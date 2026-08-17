import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";

const memorySchema = z.object({
  title: z.string().max(160),
  content: z.string().max(500),
  category: z.enum(["تفضيل", "حقيقة", "سياق", "استنتاج"]),
});

const fallbackReply = (message: string) => ({
  answer: `وصلتني رسالتك: «${message}». تعذّر الاتصال بمحرك التحليل الآن، لذلك لا أستطيع تأكيد أي استنتاج. يمكنك إعادة المحاولة أو متابعة تنظيم الفكرة يدوياً.`,
  insight: "لا تُعامل هذه الرسالة كتحليل أو حقيقة مؤكدة.",
  confidence: 0,
  suggestedMemory: null,
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  assistant: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string().trim().min(1).max(3500),
        memories: z.array(memorySchema).max(10).default([]),
        language: z.string().max(16).default("ar-SA"),
      }))
      .mutation(async ({ input }) => {
        const memoryContext = input.memories.length
          ? input.memories.map((memory) => `- ${memory.category}: ${memory.title} — ${memory.content}`).join("\n")
          : "لا توجد ذاكرة محفوظة مرتبطة مباشرة بهذا الحوار.";

        try {
          const response = await invokeLLM({
            model: "gpt-5",
            reasoning: { effort: "low" },
            maxTokens: 1200,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `أنت Rebel AI، مساعد تحليلي يتحدث العربية بوضوح. حلل الطلب بعمق لكن لا تقدّم التخمين كحقيقة ولا تدّعِ معرفة نوايا أو هوية شخص من تفاصيل محدودة. افصل بين الأدلة والاستنتاج ودرجة اليقين. لا تحفظ معلومات ولا تنفذ أي إجراء خارج المحادثة. عند وجود معلومة مفيدة للحفظ، اقترحها فقط كي يوافق المستخدم.
أعد JSON صالحاً فقط بهذه البنية: {"answer":"string","insight":"string","confidence":number,"suggestedMemory":null أو {"title":"string","content":"string","category":"تفضيل|حقيقة|سياق|استنتاج"}}. اجعل confidence عدداً من 0 إلى 100.`,
              },
              {
                role: "user",
                content: `اللغة المفضلة: ${input.language}\nالذاكرة المتاحة:\n${memoryContext}\n\nطلب المستخدم:\n${input.message}`,
              },
            ],
          });
          const content = response.choices[0]?.message?.content;
          if (!content || typeof content !== "string") return fallbackReply(input.message);
          const parsed = JSON.parse(content) as {
            answer?: unknown;
            insight?: unknown;
            confidence?: unknown;
            suggestedMemory?: unknown;
          };
          const candidateMemory = memorySchema.safeParse(parsed.suggestedMemory);
          return {
            answer: typeof parsed.answer === "string" ? parsed.answer : fallbackReply(input.message).answer,
            insight: typeof parsed.insight === "string" ? parsed.insight : "تحقق من المصدر قبل اعتماد هذه النتيجة.",
            confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50,
            suggestedMemory: candidateMemory.success ? candidateMemory.data : null,
          };
        } catch {
          return fallbackReply(input.message);
        }
      }),
  }),
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioBase64: z.string().min(20).max(12_000_000),
        mimeType: z.enum(["audio/m4a", "audio/mp4", "audio/webm", "audio/wav", "audio/mpeg"]).default("audio/m4a"),
        language: z.string().max(12).default("ar"),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: `data:${input.mimeType};base64,${input.audioBase64}`,
          language: input.language.split("-")[0],
          prompt: "Transcribe the user accurately. Preserve the spoken language and dialect. Do not add content.",
        });
        if ("error" in result) return { ok: false as const, text: "", error: result.error };
        return { ok: true as const, text: result.text.trim(), language: result.language };
      }),
  }),
});

export type AppRouter = typeof appRouter;
