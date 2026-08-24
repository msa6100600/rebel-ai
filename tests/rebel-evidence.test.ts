import { describe, expect, it } from "vitest";
import { buildRebelResponseEvidence } from "../shared/rebel-evidence";

describe("Rebel response evidence", () => {
  it("identifies the active project and the matched memories without inventing external sources", () => {
    const evidence = buildRebelResponseEvidence({
      temporary: false,
      memoryEnabled: true,
      projectName: "إطلاق Rebel",
      memoryTitles: ["الجمهور المستهدف", "قرار الواجهة"],
    });

    expect(evidence.basis).toContain("المشروع النشط: إطلاق Rebel");
    expect(evidence.basis).toContain("ذكريات مرتبطة: الجمهور المستهدف، قرار الواجهة");
    expect(evidence.limitations.some((item) => item.includes("بحث ويب"))).toBe(true);
  });

  it("states that temporary chat did not use saved memory", () => {
    const evidence = buildRebelResponseEvidence({ temporary: true, memoryEnabled: false, memoryTitles: [] });
    expect(evidence.limitations[0]).toContain("مؤقتة");
  });

  it("asks for more context when no project or matching memory is available", () => {
    const evidence = buildRebelResponseEvidence({ temporary: false, memoryEnabled: true, memoryTitles: [] });
    expect(evidence.assumptions.some((item) => item.includes("أضف سياقاً"))).toBe(true);
  });
});
