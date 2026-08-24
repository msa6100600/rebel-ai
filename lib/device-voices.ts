export type DeviceVoice = {
  identifier: string;
  language: string;
  name: string;
  quality?: unknown;
};

const norm = (value: string) => value.trim().toLowerCase();

export function selectDeviceVoice(voices: DeviceVoice[], selectedIdentifier?: string, preferredLanguage?: string): DeviceVoice | undefined {
  if (!voices.length) return undefined;
  if (selectedIdentifier) {
    const selected = voices.find((voice) => voice.identifier === selectedIdentifier);
    if (selected) return selected;
  }
  if (preferredLanguage) {
    const exact = voices.find((voice) => norm(voice.language) === norm(preferredLanguage));
    if (exact) return exact;
    const baseLanguage = norm(preferredLanguage).split("-")[0];
    const sameLanguage = voices.find((voice) => norm(voice.language).split("-")[0] === baseLanguage);
    if (sameLanguage) return sameLanguage;
  }
  return voices[0];
}

export function deviceVoiceLabel(voice: DeviceVoice | undefined) {
  if (!voice) return "صوت النظام الافتراضي";
  const name = voice.name.trim() || "صوت النظام";
  return `${name} · ${voice.language}`;
}
