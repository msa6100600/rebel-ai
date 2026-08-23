import { describe, expect, it } from "vitest";

// Provider availability is external and may change at any time. Unit tests
// must remain deterministic; run the live credential probe explicitly with
// RUN_LIVE_PROVIDER_KEY_TESTS=true and use smoke-free-models for a visible
// per-provider operational report.
const liveIt = process.env.RUN_LIVE_PROVIDER_KEY_TESTS === "true" ? it : it.skip;

const assertOk = async (label: string, response: Response) => {
  if (!response.ok) throw new Error(`${label} credential check failed with HTTP ${response.status}`);
  expect(response.ok).toBe(true);
};

describe("free model provider credentials (explicit live probe)", () => {
  liveIt("validates Gemini Flash access", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash?key=${encodeURIComponent(key!)}`);
    await assertOk("Gemini", response);
  }, 30_000);

  liveIt("validates Groq model catalog access", async () => {
    const key = process.env.GROQ_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    await assertOk("Groq", response);
  }, 30_000);

  liveIt("validates Mistral model catalog access", async () => {
    const key = process.env.MISTRAL_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch("https://api.mistral.ai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    await assertOk("Mistral", response);
  }, 30_000);
});
