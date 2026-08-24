import { describe, expect, it } from "vitest";
import { deviceVoiceLabel, selectDeviceVoice, type DeviceVoice } from "../lib/device-voices";

const voices: DeviceVoice[] = [
  { identifier: "ar-default", name: "Arabic system", language: "ar-SA" },
  { identifier: "ar-eg", name: "Egyptian system", language: "ar-EG" },
  { identifier: "en-us", name: "English system", language: "en-US" },
];

describe("اختيار أصوات الجهاز", () => {
  it("يحترم معرّف الصوت الحقيقي ولا يعيد أول صوت مطابق للغة", () => {
    expect(selectDeviceVoice(voices, "ar-eg", "ar-SA")?.identifier).toBe("ar-eg");
  });

  it("يستخدم المطابقة الدقيقة للغة عند غياب الاختيار المحفوظ", () => {
    expect(selectDeviceVoice(voices, undefined, "ar-EG")?.identifier).toBe("ar-eg");
  });

  it("يعرض تسمية الجهاز الفعلية بدلاً من اسم ملف رمزي", () => {
    expect(deviceVoiceLabel(voices[1])).toBe("Egyptian system · ar-EG");
  });
});
