import { describe, expect, it } from "vitest";
import { buildFallbackReply, compactMemories, makeMemoryKey } from "../lib/rebel-logic";

describe("rebel logic", () => {
  it("limits the memory context passed to analysis", () => {
    const result = compactMemories([
      { title: "أ", content: "1", category: "حقيقة" },
      { title: "ب", content: "2", category: "سياق" },
      { title: "ج", content: "3", category: "تفضيل" },
    ], 2);
    expect(result).toContain("أ");
    expect(result).toContain("ب");
    expect(result).not.toContain("ج");
  });

  it("creates a non-empty fallback without claiming certainty", () => {
    const reply = buildFallbackReply("حلل هذه الفكرة", []);
    expect(reply.answer).toContain("حلل هذه الفكرة");
    expect(reply.confidence).toBeLessThan(50);
  });

  it("normalizes a memory key to reduce duplicates", () => {
    expect(makeMemoryKey(" مشروعي ", " تطبيق ذكي ")).toBe(makeMemoryKey("مشروعي", "تطبيق ذكي"));
  });
});

