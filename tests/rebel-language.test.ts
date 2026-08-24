import { describe, expect, it } from "vitest";
import { getTextLanguageGuidance, resolveTextLanguage } from "../shared/rebel-language";

describe("لغة رد Rebel", () => {
  it("يدعم المصرية كتفضيل نص مستقل", () => {
    expect(getTextLanguageGuidance("ar-eg").instruction).toContain("المصرية");
  });

  it("يحوّل إعدادات النسخ القديمة إلى وضع فصحى أو لهجة مناسب", () => {
    expect(resolveTextLanguage("ar-SA").id).toBe("ar-fusha");
    expect(resolveTextLanguage("en-GB").id).toBe("en");
  });

  it("يعود إلى الفصحى عندما تصل قيمة غير معروفة", () => {
    expect(resolveTextLanguage("unknown").id).toBe("ar-fusha");
  });
});
