export const FREE_MODELS = ["gemini-3.6-flash", "qwen/qwen3.6-27b", "mistral-small-latest"] as const;
export const FREE_MODEL_PRIORITY = [...FREE_MODELS];

export type FreeModel = (typeof FREE_MODELS)[number];
export type FreeProvider = "gemini" | "groq" | "mistral";
export type ProviderKeyOverrides = Partial<Record<FreeProvider, string>>;

type ProviderMessage = { role: "system" | "user"; content: string };

export const freeProviderMetadata: Record<FreeModel, { provider: FreeProvider; label: string }> = {
  "gemini-3.6-flash": { provider: "gemini", label: "Gemini 3.6 Flash" },
  "qwen/qwen3.6-27b": { provider: "groq", label: "Qwen 3.6 عبر Groq" },
  "mistral-small-latest": { provider: "mistral", label: "Mistral Small" },
};

export class FreeProviderError extends Error {
  constructor(
    public readonly kind: "rate_limit" | "authentication" | "provider_unavailable" | "invalid_response",
    public readonly provider: FreeProvider,
    public readonly retryAfterSeconds?: number,
    public readonly statusCode?: number,
    public readonly diagnostic?: string,
  ) {
    super(kind);
  }
}

export class AllFreeProvidersRateLimitedError extends Error {
  constructor(public readonly attemptedModels: FreeModel[]) {
    super("all_free_providers_rate_limited");
  }
}

const retryAfterSeconds = (response: Response) => {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
};

const toProviderError = async (provider: FreeProvider, response: Response) => {
  const diagnostic = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300) || undefined;
  const hasLimitSignal = /resource_exhausted|quota|rate[ _-]?limit|daily[ _-]?limit|limit[ _-]?exceeded/i.test(diagnostic ?? "");
  if (response.status === 429 || hasLimitSignal) return new FreeProviderError("rate_limit", provider, retryAfterSeconds(response), response.status, diagnostic);
  if (response.status === 401 || response.status === 403) return new FreeProviderError("authentication", provider, undefined, response.status, diagnostic);
  return new FreeProviderError("provider_unavailable", provider, undefined, response.status, diagnostic);
};

const ensureText = (value: unknown, provider: FreeProvider) => {
  if (typeof value !== "string" || !value.trim()) throw new FreeProviderError("invalid_response", provider);
  return value.trim();
};

const removeReasoning = (value: unknown) => typeof value === "string" ? value.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim() : value;

const systemMessage = (messages: ProviderMessage[]) => messages.find((message) => message.role === "system")?.content ?? "";
const userMessage = (messages: ProviderMessage[]) => messages.filter((message) => message.role === "user").map((message) => message.content).join("\n\n");

async function callGemini(messages: ProviderMessage[], keyOverride?: string) {
  const key = keyOverride ?? process.env.GEMINI_API_KEY;
  if (!key) throw new FreeProviderError("authentication", "gemini");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemMessage(messages) }] },
      contents: [{ role: "user", parts: [{ text: userMessage(messages) }] }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 1200 },
    }),
  });
  if (!response.ok) throw await toProviderError("gemini", response);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  return ensureText(payload.candidates?.[0]?.content?.parts?.map((part) => part.text).filter((text): text is string => typeof text === "string").join("\n"), "gemini");
}

async function callOpenAiCompatible(provider: "groq" | "mistral", model: FreeModel, messages: ProviderMessage[], keyOverride?: string) {
  const key = keyOverride ?? (provider === "groq" ? process.env.GROQ_API_KEY : process.env.MISTRAL_API_KEY);
  if (!key) throw new FreeProviderError("authentication", provider);
  const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 1200, ...(provider === "groq" ? { reasoning_effort: "none" } : {}) }),
  });
  if (!response.ok) throw await toProviderError(provider, response);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  return ensureText(removeReasoning(payload.choices?.[0]?.message?.content), provider);
}

export async function runFreeProvider(model: FreeModel, messages: ProviderMessage[], providerKeys?: ProviderKeyOverrides) {
  if (model === "gemini-3.6-flash") return callGemini(messages, providerKeys?.gemini);
  if (model === "qwen/qwen3.6-27b") return callOpenAiCompatible("groq", model, messages, providerKeys?.groq);
  return callOpenAiCompatible("mistral", model, messages, providerKeys?.mistral);
}

export async function runFreeProviderWithFallback(initialModel: FreeModel, messages: ProviderMessage[], providerKeys?: ProviderKeyOverrides) {
  const order = [initialModel, ...FREE_MODEL_PRIORITY.filter((model) => model !== initialModel)] as FreeModel[];
  const rateLimited: FreeModel[] = [];
  for (const model of order) {
    try {
      const answer = await runFreeProvider(model, messages, providerKeys);
      return { answer, model, fallbackUsed: model !== initialModel, attemptedModels: order.slice(0, rateLimited.length + 1) };
    } catch (error) {
      if (error instanceof FreeProviderError && error.kind === "rate_limit") {
        rateLimited.push(model);
        continue;
      }
      throw error;
    }
  }
  throw new AllFreeProvidersRateLimitedError(rateLimited);
}
