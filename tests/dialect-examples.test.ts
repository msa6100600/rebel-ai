import { describe, expect, it } from "vitest";
import { DIALECT_EXAMPLE_BANK, getDialectExamples } from "../shared/dialect-examples";

describe("dialect example bank", () => {
  it("covers every supported Arabic response style with expandable natural examples", () => {
    expect(new Set(DIALECT_EXAMPLE_BANK.map((example) => example.language))).toEqual(
      new Set(["ar-fusha", "ar-eg", "ar-gulf", "ar-levant"]),
    );
    expect(DIALECT_EXAMPLE_BANK.every((example) => example.quality === "طبيعي" && example.userMessage.length > 4 && example.qualityNote.length > 10)).toBe(true);
  });

  it("returns examples scoped to the requested dialect only", () => {
    const egyptian = getDialectExamples("ar-eg");
    expect(egyptian.length).toBeGreaterThan(0);
    expect(egyptian.every((example) => example.language === "ar-eg" && example.expectedDialect === "المصرية")).toBe(true);
  });
});
