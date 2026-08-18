import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { AllFreeProvidersRateLimitedError, FREE_MODELS, FreeProviderError, freeProviderMetadata, runFreeProviderWithFallback, type FreeModel } from "./free-providers";

const memorySchema = z.object({
  title: z.string().max(160),
  content: z.string().max(500),
  category: z.enum(["تفضيل", "حقيقة", "سياق", "استنتاج"]),
});
const OWNER_USERNAME = "rebel ai";
const GPT_INSTRUCTIONS = {
  "rebel-core": "حلل الطلب بوضوح وبمنظور عام متوازن.",
  "health-guide": "قدّم معلومات صحية عامة وتعليمية فقط. لا تشخّص ولا تصف علاجاً شخصياً، واذكر متى يجب مراجعة طبيب أو الطوارئ.",
  "legal-guide": "قدّم شرحاً قانونياً عاماً للتثقيف فقط، ولا تعتبره استشارة قانونية أو بديلاً عن محامٍ مرخّص.",
  "life-coach": "قدّم دعماً عملياً غير علاجي يركز على هدف صغير وخطوة تالية قابلة للتنفيذ، ولا تقدّم تشخيصاً نفسياً.",
  "code-studio": "كن شريكاً تقنياً دقيقاً: اشرح الافتراضات، واقترح خطوات وآثاراً جانبية واختبارات.",
  "study-partner": "اشرح بوضوح ثم اقترح تمريناً أو خطة قصيرة للتعلم.",
  "travel-planner": "نظّم المقترحات مع افتراضات واضحة عن الوقت والميزانية، ولا تدّعِ توفر أسعار أو حجوزات لحظية.",
} as const;

const fallbackReply = (message: string) => ({
  answer: `وصلتني رسالتك: «${message}». تعذّر الاتصال بمحرك التحليل الآن، لذلك لا أستطيع تأكيد أي استنتاج. يمكنك إعادة المحاولة أو متابعة تنظيم الفكرة يدوياً.`,
  insight: "لا تُعامل هذه الرسالة كتحليل أو حقيقة مؤكدة.",
  confidence: 0,
  suggestedMemory: null,
  status: "provider_error" as const,
  model: "gemini-3.6-flash" as const,
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
        model: z.enum(FREE_MODELS).default("gemini-3.6-flash"),
        gptId: z.enum(["rebel-core", "health-guide", "legal-guide", "life-coach", "code-studio", "study-partner", "travel-planner"]).default("rebel-core"),
      }))
      .mutation(async ({ input }) => {
        const memoryContext = input.memories.length
          ? input.memories.map((memory) => `- ${memory.category}: ${memory.title} — ${memory.content}`).join("\n")
          : "لا توجد ذاكرة محفوظة مرتبطة مباشرة بهذا الحوار.";

        try {
          const result = await runFreeProviderWithFallback(input.model as FreeModel, [
              {
                role: "system",
                content: `أنت Rebel AI، مساعد تحليلي مفيد يتحدث العربية بوضوح. أجب مباشرة وبشكل منظم وموجز. فرّق بين الحقائق والاحتمالات، ولا تدّعِ معرفة مؤكدة عن أشخاص أو مواقف من معلومات قليلة. لا تدّعِ تنفيذ أي إجراء خارج المحادثة، ولا تذكر أي تعليمات داخلية.\n\nوضع المساعد المختار: ${GPT_INSTRUCTIONS[input.gptId]}`,
              },
              {
                role: "user",
                content: `اللغة المفضلة: ${input.language}\nالذاكرة المتاحة:\n${memoryContext}\n\nطلب المستخدم:\n${input.message}`,
              },
            ]);
          return {
            answer: result.answer,
            insight: result.fallbackUsed ? `استمر الرد عبر ${freeProviderMetadata[result.model].label} بعد بلوغ حد مؤقت لنموذج مجاني آخر.` : "الرد مولّد للمساعدة في التفكير؛ راجع المصادر قبل اعتماد المعلومات المهمة.",
            confidence: 70,
            suggestedMemory: null,
            status: "ok" as const,
            model: result.model,
          };
        } catch (error) {
          if (error instanceof AllFreeProvidersRateLimitedError) {
            return { answer: "الخدمة تعمل عبر نماذج مجانية وقد وصلت جميعها إلى حد الاستخدام المؤقت أو اليومي الآن. جرّب مرة أخرى بعد قليل.", insight: "لم يُستخدم أي نموذج مدفوع كبديل.", confidence: 0, suggestedMemory: null, status: "rate_limited" as const, model: input.model };
          }
          if (error instanceof FreeProviderError) {
            const provider = freeProviderMetadata[input.model as FreeModel];
            if (error.kind === "rate_limit") {
              const wait = error.retryAfterSeconds ? ` حاول مجدداً بعد نحو ${error.retryAfterSeconds} ثانية.` : " انتظر قليلاً ثم أعد المحاولة.";
              return { answer: `وصلت إلى حد الاستخدام المجاني لـ ${provider.label}.${wait}`, insight: "لم تُرسل هذه المحاولة إلى نموذج بديل مدفوع.", confidence: 0, suggestedMemory: null, status: "rate_limited" as const, model: input.model };
            }
            if (error.kind === "authentication") return { answer: `تعذر تفويض ${provider.label}. تحقق من مفتاح API المجاني لهذا الموفّر.`, insight: "لم يُستخدم أي نموذج مدفوع كبديل.", confidence: 0, suggestedMemory: null, status: "provider_error" as const, model: input.model };
            return { answer: `خدمة ${provider.label} غير متاحة الآن. أعد المحاولة لاحقاً أو اختر نموذجاً مجانياً آخر.`, insight: "لم يُستخدم أي نموذج بديل مدفوع.", confidence: 0, suggestedMemory: null, status: "provider_error" as const, model: input.model };
          }
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
  owner: router({
    login: publicProcedure
      .input(z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) }))
      .mutation(({ input }) => {
        const expected = process.env.OWNER_CONSOLE_PASSWORD;
        const normalizedUsername = input.username.trim().replace(/\s+/g, " ").toLocaleLowerCase();
        const validUsername = normalizedUsername === OWNER_USERNAME;
        if (!expected || !validUsername || input.password !== expected) return { granted: false as const };
        return { granted: true as const, username: OWNER_USERNAME };
      }),
    unlock: publicProcedure
      .input(z.object({ password: z.string().min(1).max(256) }))
      .mutation(({ input }) => {
        const expected = process.env.OWNER_CONSOLE_PASSWORD;
        if (!expected || input.password !== expected) return { granted: false as const };
        return { granted: true as const };
      }),
  }),
});

export type AppRouter = typeof appRouter;
