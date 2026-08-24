import type { TextLanguageId } from "./rebel-language";

export type ArabicDialectId = Extract<TextLanguageId, "ar-fusha" | "ar-eg" | "ar-gulf" | "ar-levant">;

export type DialectExample = {
  id: string;
  language: ArabicDialectId;
  expectedDialect: "الفصحى الحديثة" | "المصرية" | "الخليجية البيضاء" | "الشامية البيضاء";
  userMessage: string;
  quality: "طبيعي" | "غير طبيعي";
  qualityNote: string;
};

/**
 * عينات قصيرة للمراجعة اليدوية واختبارات الانحدار المستقبلية. لا تمثل هذه
 * العبارات قاعدة معرفة أو محتوى مستخدمين، ولا تُرسل إلى المزودين تلقائياً.
 */
export const DIALECT_EXAMPLE_BANK: readonly DialectExample[] = [
  {
    id: "fusha-summary",
    language: "ar-fusha",
    expectedDialect: "الفصحى الحديثة",
    userMessage: "لخّص لي فكرة المشروع في ثلاث نقاط واضحة.",
    quality: "طبيعي",
    qualityNote: "فصحى حديثة مباشرة، بلا تراكيب كلاسيكية ثقيلة أو انتقال إلى العامية.",
  },
  {
    id: "fusha-technical",
    language: "ar-fusha",
    expectedDialect: "الفصحى الحديثة",
    userMessage: "ما الفرق بين النسخ الاحتياطي والتشفير؟",
    quality: "طبيعي",
    qualityNote: "يحافظ على المصطلحين الدقيقين ويشرحهما بلغة سهلة ومهنية.",
  },
  {
    id: "egyptian-plan",
    language: "ar-eg",
    expectedDialect: "المصرية",
    userMessage: "رتّبلي خطة بسيطة أبدأ بيها مذاكرة الأسبوع ده.",
    quality: "طبيعي",
    qualityNote: "مصرية محترمة ومألوفة بجمل قصيرة، من غير تمثيل أو خلط خليجي وشامي.",
  },
  {
    id: "egyptian-technical",
    language: "ar-eg",
    expectedDialect: "المصرية",
    userMessage: "يعني إيه تشفير البيانات بطريقة سهلة؟",
    quality: "طبيعي",
    qualityNote: "يذكر مصطلح «تشفير البيانات» بالفصحى ثم يشرحه بالمصري ببساطة.",
  },
  {
    id: "gulf-decision",
    language: "ar-gulf",
    expectedDialect: "الخليجية البيضاء",
    userMessage: "ساعدني أرتب الأولويات قبل ما أبدأ بالمشروع.",
    quality: "طبيعي",
    qualityNote: "لهجة خليجية بيضاء راقية ومفهومة، من غير تقليد مدينة أو مفردات محلية نادرة.",
  },
  {
    id: "gulf-technical",
    language: "ar-gulf",
    expectedDialect: "الخليجية البيضاء",
    userMessage: "وش أفضل طريقة أحفظ فيها بياناتي؟",
    quality: "طبيعي",
    qualityNote: "يستخدم الفصحى للمصطلح التقني مثل النسخ الاحتياطي ثم يوضحه بعبارة خليجية بسيطة.",
  },
  {
    id: "levant-outline",
    language: "ar-levant",
    expectedDialect: "الشامية البيضاء",
    userMessage: "رتّبلي خطوات أبدأ فيها اليوم.",
    quality: "طبيعي",
    qualityNote: "شامية بيضاء قصيرة ومحترمة، من غير خلط مصري أو خليجي أو مبالغة محلية.",
  },
  {
    id: "levant-technical",
    language: "ar-levant",
    expectedDialect: "الشامية البيضاء",
    userMessage: "شو يعني حماية الخصوصية بالتطبيق؟",
    quality: "طبيعي",
    qualityNote: "يبقي «حماية الخصوصية» مصطلحاً واضحاً ثم يشرح المعنى بالشامي البسيط.",
  },
];

export function getDialectExamples(language: ArabicDialectId) {
  return DIALECT_EXAMPLE_BANK.filter((example) => example.language === language);
}
