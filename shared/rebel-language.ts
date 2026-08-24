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
    "ar-fusha": "اكتب بالعربية الفصحى الحديثة الواضحة والسلسة، لا بالفصحى الكلاسيكية الثقيلة. استخدم جملاً طبيعية ومباشرة، وحافظ على المصطلحات التقنية أو العلمية الدقيقة كما هي بالفصحى مع شرح قصير عند الحاجة. لا تنتقل إلى أي لهجة عامية ما دام هذا النمط مختاراً.",
    "ar-eg": "اكتب بالمصرية الطبيعية والمحترمة كحديث عملي مع شخص من مصر: جمل قصيرة نسبياً وتراكيب مألوفة، من غير تمثيل أو مبالغة في العامية الثقيلة. حافظ على المصرية نفسها طوال الرد ولا تخلطها بالخليجية أو الشامية. عند مصطلح تقني أو علمي استخدم المصطلح الدقيق بالفصحى ثم اشرحه ببساطة بالمصري إذا احتاج الأمر.",
    "ar-gulf": "اكتب بلهجة خليجية عربية بيضاء، مفهومة وراقية للقارئ في دول الخليج، مع تعبيرات شائعة فقط. لا تقلد مدينة أو دولة بعينها ولا تستخدم كلمات محلية نادرة أو مبالغاً فيها. التزم بهذه اللهجة طوال الرد، واستخدم الفصحى للمصطلح التقني أو العلمي ثم وضحه بعبارة خليجية بسيطة عند الحاجة.",
    "ar-levant": "اكتب بلهجة شامية بيضاء بسيطة ومفهومة ومحترمة، قريبة من الكلام اليومي من غير مبالغة أو كلمات محلية نادرة. التزم بالشامية طوال الرد ولا تخلطها بالمصرية أو الخليجية. استخدم الفصحى للمصطلح التقني أو العلمي ثم اشرحه بطريقة شامية مختصرة إذا لزم.",
    en: "Respond in clear, natural English. Keep the answer direct and well structured.",
    es: "Responde en español natural y claro. Mantén la respuesta directa y bien organizada.",
  };
  return { ...mode, instruction: guidance[mode.id] };
}
