export const textLanguageModes = [
  { id: "ar-fusha", label: "العربية الفصحى", locale: "ar-SA", detail: "فصحى حديثة واضحة" },
  { id: "ar-eg", label: "المصرية", locale: "ar-EG", detail: "عامية مصرية طبيعية ومحترمة" },
  { id: "ar-gulf", label: "الخليجية", locale: "ar-AE", detail: "لهجة خليجية مفهومة" },
  { id: "ar-levant", label: "الشامية", locale: "ar-LB", detail: "لهجة شامية بسيطة" },
  { id: "en", label: "English", locale: "en-US", detail: "Natural English" },
  { id: "es", label: "Español", locale: "es-ES", detail: "Español natural" },
] as const;

export type TextLanguageId = (typeof textLanguageModes)[number]["id"];

const legacyLocaleMap: Record<string, TextLanguageId> = {
  "ar-sa": "ar-fusha",
  "ar-eg": "ar-eg",
  "ar-ae": "ar-gulf",
  "ar-lb": "ar-levant",
  "en-us": "en",
  "en-gb": "en",
  "es-es": "es",
};

export function resolveTextLanguage(value?: string) {
  const normalized = value?.trim().toLowerCase();
  const id = textLanguageModes.some((mode) => mode.id === normalized)
    ? normalized as TextLanguageId
    : legacyLocaleMap[normalized ?? ""] ?? "ar-fusha";
  return textLanguageModes.find((mode) => mode.id === id) ?? textLanguageModes[0];
}

export function getTextLanguageGuidance(value?: string) {
  const mode = resolveTextLanguage(value);
  const guidance: Record<TextLanguageId, string> = {
    "ar-fusha": "اكتب بالعربية الفصحى الحديثة الواضحة. لا تستخدم لهجة عامية إلا إذا طلب المستخدم ذلك صراحة.",
    "ar-eg": "اكتب بالمصرية الطبيعية والمحترمة، وبجمل سهلة كأنك تتحدث مع شخص من مصر. لا تخلطها بالفصحى إلا عند الحاجة إلى مصطلح دقيق.",
    "ar-gulf": "اكتب بلهجة خليجية مفهومة ومحترمة، وتجنب المبالغة أو تقليد لهجة محددة بشكل غير طبيعي.",
    "ar-levant": "اكتب بلهجة شامية بسيطة ومفهومة ومحترمة، وتجنب المبالغة أو الكلمات المحلية النادرة.",
    en: "Respond in clear, natural English. Keep the answer direct and well structured.",
    es: "Responde en español natural y claro. Mantén la respuesta directa y bien organizada.",
  };
  return { ...mode, instruction: guidance[mode.id] };
}
