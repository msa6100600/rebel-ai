import { describe, expect, it } from "vitest";
import { getTextLanguageGuidance, resolveTextLanguage } from "../shared/rebel-language";

describe("لغة رد Rebel", () => {
  it("يدعم المصرية كتفضيل نص مستقل", () => {
    const instruction = getTextLanguageGuidance("ar-eg").instruction;
    expect(instruction).toContain("المصرية");
    expect(instruction).toContain("لا تخلطها بالخليجية أو الشامية");
    expect(instruction).toContain("مصطلح تقني أو علمي");
  });

  it("يمنح كل لهجة عربية قواعد طبيعية مستقلة", () => {
    expect(getTextLanguageGuidance("ar-fusha").instruction).toContain("الفصحى الكلاسيكية الثقيلة");
    expect(getTextLanguageGuidance("ar-gulf").instruction).toContain("لا تقلد مدينة أو دولة بعينها");
    expect(getTextLanguageGuidance("ar-levant").instruction).toContain("لا تخلطها بالمصرية أو الخليجية");
  });

  it("يحوّل إعدادات النسخ القديمة إلى وضع فصحى أو لهجة مناسب", () => {
    expect(resolveTextLanguage("ar-SA").id).toBe("ar-fusha");
    expect(resolveTextLanguage("en-GB").id).toBe("en");
  });

  it("يعود إلى الفصحى عندما تصل قيمة غير معروفة", () => {
    expect(resolveTextLanguage("unknown").id).toBe("ar-fusha");
  });
});
