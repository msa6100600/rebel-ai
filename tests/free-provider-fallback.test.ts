import { afterEach, describe, expect, it, vi } from "vitest";
import { AllFreeProvidersRateLimitedError, runFreeProviderWithFallback } from "../server/free-providers";

const messages = [{ role: "user" as const, content: "اختبار عربي" }];

describe("free provider fallback", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; vi.unstubAllEnvs(); });

  it("moves from Gemini to Groq after a rate limit", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini");
    vi.stubEnv("GROQ_API_KEY", "test-groq");
    global.fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "5" } })).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "أهلاً من Groq" } }] }), { status: 200 })) as typeof fetch;
    const result = await runFreeProviderWithFallback("gemini-3.6-flash", messages);
    expect(result.model).toBe("qwen/qwen3.6-27b");
    expect(result.fallbackUsed).toBe(true);
    expect(result.answer).toContain("Groq");
  });

  it("tries Gemini then Groq then Mistral before reporting free-tier exhaustion", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini");
    vi.stubEnv("GROQ_API_KEY", "test-groq");
    vi.stubEnv("MISTRAL_API_KEY", "test-mistral");
    global.fetch = vi.fn().mockResolvedValue(new Response("{\"error\":{\"status\":\"RESOURCE_EXHAUSTED\"}}", { status: 429 })) as typeof fetch;
    await expect(runFreeProviderWithFallback("gemini-3.6-flash", messages)).rejects.toMatchObject({
      attemptedModels: ["gemini-3.6-flash", "qwen/qwen3.6-27b", "mistral-small-latest"],
    } satisfies Partial<AllFreeProvidersRateLimitedError>);
  });
});
