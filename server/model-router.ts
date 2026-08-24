import {
  FREE_MODELS,
  FREE_MODEL_PRIORITY,
  runFreeProviderWithFallback,
  type FreeModel,
  type ProviderKeyOverrides,
} from "./free-providers";

export type RouterContext = {
  message: string;
  modality?: "text" | "voice";
  preferredModel?: FreeModel;
  isArabicHeavy?: boolean;
  complexityHint?: "low" | "medium" | "high";
};

export type RouterDecision = {
  initialModel: FreeModel;
  reason: "user-preference" | "short-fast" | "arabic-heavy" | "default-balanced";
  order: FreeModel[];
};

const hasKnownModel = (value: unknown): value is FreeModel =>
  typeof value === "string" && (FREE_MODELS as readonly string[]).includes(value);

/**
 * يحدد نقطة البداية لمسار النماذج المجانية فقط. أولوية المستخدم أعلى
 * من التخمينات؛ لذلك لا يبدل اختياره إلى نموذج آخر من دون إذن صريح.
 */
export function decideModel(ctx: RouterContext): RouterDecision {
  const text = ctx.message.trim();
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const isArabicHeavy = ctx.isArabicHeavy ?? arabicChars / Math.max(text.length, 1) > 0.32;

  if (hasKnownModel(ctx.preferredModel)) {
    const index = FREE_MODEL_PRIORITY.indexOf(ctx.preferredModel);
    return { initialModel: ctx.preferredModel, reason: "user-preference", order: FREE_MODEL_PRIORITY.slice(index) as FreeModel[] };
  }
  if (text.length < 45 && ctx.complexityHint !== "high") return { initialModel: "gemini-3.6-flash", reason: "short-fast", order: [...FREE_MODEL_PRIORITY] };
  if (isArabicHeavy) return { initialModel: "gemini-3.6-flash", reason: "arabic-heavy", order: [...FREE_MODEL_PRIORITY] };
  return { initialModel: "gemini-3.6-flash", reason: "default-balanced", order: [...FREE_MODEL_PRIORITY] };
}

export async function runWithIntelligentRouter(
  ctx: RouterContext,
  messages: { role: "system" | "user"; content: string }[],
  providerKeys?: ProviderKeyOverrides,
) {
  const decision = decideModel(ctx);
  const result = await runFreeProviderWithFallback(decision.initialModel, messages, providerKeys);
  return { ...result, routerReason: decision.reason, routerOrder: decision.order };
}
