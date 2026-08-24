import { describe, expect, it } from "vitest";
import { decideModel } from "../server/model-router";

describe("intelligent model router", () => {
  it("honours an explicit model choice and only falls forward", () => {
    expect(decideModel({ message: "حلل هذه الرسالة الطويلة", preferredModel: "qwen/qwen3.6-27b" })).toEqual({
      initialModel: "qwen/qwen3.6-27b",
      reason: "user-preference",
      order: ["qwen/qwen3.6-27b", "mistral-small-latest"],
    });
  });

  it("starts Arabic requests at Gemini when automatic routing is used", () => {
    const decision = decideModel({ message: "حلل لي هذه الفكرة العربية مع توضيح الافتراضات والحدود" });
    expect(decision.initialModel).toBe("gemini-3.6-flash");
    expect(decision.reason).toBe("arabic-heavy");
  });

  it("starts short automatic requests at Gemini", () => {
    expect(decideModel({ message: "اختصر هذا" }).reason).toBe("short-fast");
  });
});
