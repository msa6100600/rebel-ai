import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useRebelSession } from "@/lib/rebel-session";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
  insight?: string;
  confidence?: number;
  isError?: boolean;
  model?: FreeModelId;
};

export type MemoryItem = {
  id: string;
  title: string;
  content: string;
  category: "تفضيل" | "حقيقة" | "سياق" | "استنتاج";
  createdAt: string;
  source: "محادثة" | "موافقة المستخدم" | "إضافة يدوية";
};

export type SourceItem = {
  id: string;
  title: string;
  domain: string;
  status: "موثوق" | "قيد المراجعة" | "يحتاج تحققاً";
  score: number;
  note: string;
};

export type ApprovalItem = {
  id: string;
  title: string;
  detail: string;
  type: "تعلم مقترح" | "إجراء مقترح";
  createdAt: string;
  status: "بانتظار قرارك" | "تمت الموافقة" | "تم الرفض";
  memory?: Omit<MemoryItem, "id" | "createdAt" | "source">;
};

export type VoiceProfile = {
  id: string;
  name: string;
  gender: "صوت نسائي" | "صوت رجالي";
  language: string;
  dialect: string;
  pitch: number;
  rate: number;
};

export type FreeModelId = "gemini-3.6-flash" | "qwen/qwen3.6-27b" | "mistral-small-latest";

export const freeModels: Array<{ id: FreeModelId; provider: "gemini" | "groq" | "mistral"; name: string; shortName: string; description: string }> = [
  { id: "gemini-3.6-flash", provider: "gemini", name: "Gemini 3.6 Flash", shortName: "Gemini Flash", description: "الخيار الافتراضي السريع المتاح حالياً للمحادثة العربية والتحليل اليومي." },
  { id: "qwen/qwen3.6-27b", provider: "groq", name: "Qwen 3.6 · Groq", shortName: "Qwen · Groq", description: "نموذج متاح على Groq للاستجابات السريعة والتحليل النصي." },
  { id: "mistral-small-latest", provider: "mistral", name: "Mistral Small", shortName: "Mistral Small", description: "نموذج صغير متوازن للكتابة والشرح والتحليل." },
];

export type RebelGptProfile = {
  id: "rebel-core" | "health-guide" | "legal-guide" | "life-coach" | "code-studio" | "study-partner" | "travel-planner";
  name: string;
  shortName: string;
  description: string;
  category: string;
  icon: "sparkles" | "medical" | "gavel" | "favorite" | "code" | "school" | "airplane";
  color: string;
};

export const rebelGpts: RebelGptProfile[] = [
  { id: "rebel-core", name: "Rebel AI", shortName: "Rebel", description: "مساعدك العام للتحليل والكتابة وربط الأفكار.", category: "عام", icon: "sparkles", color: "#2563EB" },
  { id: "health-guide", name: "الدليل الصحي", shortName: "صحة", description: "يفسّر المعلومات الصحية العامة ويساعدك على تجهيز أسئلتك للطبيب.", category: "صحة عامة", icon: "medical", color: "#0F8B72" },
  { id: "legal-guide", name: "الدليل القانوني", shortName: "قانون", description: "ينظم المفاهيم القانونية العامة ولا يقدم بديلاً عن محامٍ مرخّص.", category: "معلومات عامة", icon: "gavel", color: "#7C4DFF" },
  { id: "life-coach", name: "مدرب الحياة", shortName: "توازن", description: "يساعدك على تحديد هدف وخطوة صغيرة ومتابعة عملية.", category: "تطوير شخصي", icon: "favorite", color: "#D05A7B" },
  { id: "code-studio", name: "Rebel Code", shortName: "برمجة", description: "شريك للبرمجة والتصميم والتخطيط الفني خطوة بخطوة.", category: "تقنية", icon: "code", color: "#2475C6" },
  { id: "study-partner", name: "شريك التعلّم", shortName: "تعلّم", description: "يشرح الدروس ويصنع خطة مذاكرة وأسئلة تدريبية.", category: "تعليم", icon: "school", color: "#B66B12" },
  { id: "travel-planner", name: "مخطط الرحلات", shortName: "سفر", description: "ينظم أفكار الرحلة والميزانية وقائمة الاستعداد.", category: "تخطيط", icon: "airplane", color: "#167C9A" },
];

export const voiceProfiles: VoiceProfile[] = [
  { id: "lina", name: "لينا", gender: "صوت نسائي", language: "ar-SA", dialect: "العربية الفصحى", pitch: 1.1, rate: 0.94 },
  { id: "nour", name: "نور", gender: "صوت نسائي", language: "ar-EG", dialect: "المصرية", pitch: 1.14, rate: 0.98 },
  { id: "maya", name: "مايا", gender: "صوت نسائي", language: "ar-LB", dialect: "الشامية", pitch: 1.08, rate: 0.96 },
  { id: "reema", name: "ريما", gender: "صوت نسائي", language: "ar-AE", dialect: "الخليجية", pitch: 1.05, rate: 0.94 },
  { id: "sofia", name: "Sofia", gender: "صوت نسائي", language: "en-US", dialect: "English · US", pitch: 1.06, rate: 0.96 },
  { id: "omar", name: "عمر", gender: "صوت رجالي", language: "ar-SA", dialect: "العربية الفصحى", pitch: 0.86, rate: 0.94 },
  { id: "karim", name: "كريم", gender: "صوت رجالي", language: "ar-EG", dialect: "المصرية", pitch: 0.9, rate: 0.98 },
  { id: "zayd", name: "زيد", gender: "صوت رجالي", language: "ar-AE", dialect: "الخليجية", pitch: 0.88, rate: 0.94 },
  { id: "adam", name: "Adam", gender: "صوت رجالي", language: "en-GB", dialect: "English · UK", pitch: 0.86, rate: 0.94 },
  { id: "diego", name: "Diego", gender: "صوت رجالي", language: "es-ES", dialect: "Español · España", pitch: 0.9, rate: 0.96 },
];

export type Preferences = {
  selectedVoiceId: string;
  preferredLanguage: string;
  selectedProvider: "gemini" | "groq" | "mistral";
  selectedModel: FreeModelId;
  selectedGptId: RebelGptProfile["id"];
  allowSuggestedLearning: boolean;
  hapticsEnabled: boolean;
};

export type OwnerRequest = {
  id: string;
  request: string;
  createdAt: string;
  status: "مقترح للمراجعة";
};

type RebelState = {
  hydrated: boolean;
  messages: ChatMessage[];
  memories: MemoryItem[];
  sources: SourceItem[];
  approvals: ApprovalItem[];
  ownerRequests: OwnerRequest[];
  preferences: Preferences;
  addMessage: (message: Omit<ChatMessage, "id" | "createdAt">) => void;
  addMemory: (memory: Omit<MemoryItem, "id" | "createdAt">) => void;
  removeMemory: (id: string) => void;
  addApproval: (approval: Omit<ApprovalItem, "id" | "createdAt" | "status">) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  addOwnerRequest: (request: string) => void;
  updatePreferences: (changes: Partial<Preferences>) => void;
  clearMessages: () => void;
  clearMemories: () => void;
};

const STORAGE_KEY_PREFIX = "rebel-ai-state-v4:";
const RETIRED_STORAGE_KEYS = ["rebel-ai-state-v1", "rebel-ai-state-v2"];

const defaultSources: SourceItem[] = [
  { id: "s1", title: "المصدر العلمي", domain: "journals / universities", status: "موثوق", score: 91, note: "يحتاج مراجعة تاريخ النشر والمنهجية." },
  { id: "s2", title: "مرجع تقني", domain: "official documentation", status: "موثوق", score: 88, note: "التوثيق الرسمي هو المرجع الأول قبل التعميم." },
  { id: "s3", title: "معلومة من المحادثة", domain: "user-provided", status: "قيد المراجعة", score: 54, note: "لا تُحفظ كحقيقة قبل قرارك أو إسنادها لمصدر." },
];

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "أنا Rebel AI. أرتّب الأدلة والروابط والاستنتاجات، وأفصل دائماً بين الحقيقة والاحتمال. ماذا تريد أن نحلّل؟",
    createdAt: new Date().toISOString(),
    insight: "لن أحفظ معرفة جديدة أو أنفذ إجراءً قبل موافقتك.",
    confidence: 100,
  },
];

const defaultPreferences: Preferences = {
  selectedVoiceId: "lina",
  preferredLanguage: "ar-SA",
  selectedProvider: "gemini",
  selectedModel: "gemini-3.6-flash",
  selectedGptId: "rebel-core",
  allowSuggestedLearning: true,
  hapticsEnabled: true,
};

const RebelContext = createContext<RebelState | null>(null);

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function RebelStoreProvider({ children }: { children: ReactNode }) {
  const { session } = useRebelSession();
  const accountStorageKey = session ? `${STORAGE_KEY_PREFIX}${session.account.id}` : null;
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [sources] = useState<SourceItem[]>(defaultSources);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [ownerRequests, setOwnerRequests] = useState<OwnerRequest[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  useEffect(() => {
    setHydrated(false);
    setMessages(starterMessages);
    setMemories([]);
    setApprovals([]);
    setOwnerRequests([]);
    setPreferences(defaultPreferences);
    AsyncStorage.multiRemove(RETIRED_STORAGE_KEYS)
      .catch(() => undefined)
      .then(() => accountStorageKey ? AsyncStorage.getItem(accountStorageKey) : null)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Pick<RebelState, "messages" | "memories" | "approvals" | "ownerRequests" | "preferences">>;
        if (parsed.messages?.length) setMessages(parsed.messages);
        if (parsed.memories) setMemories(parsed.memories);
        if (parsed.approvals) setApprovals(parsed.approvals);
        if (parsed.ownerRequests) setOwnerRequests(parsed.ownerRequests);
        if (parsed.preferences) {
          const candidate = parsed.preferences as Partial<Preferences>;
          const model = freeModels.find((item) => item.id === candidate.selectedModel);
          setPreferences({ ...defaultPreferences, ...candidate, selectedModel: model?.id ?? defaultPreferences.selectedModel, selectedProvider: model?.provider ?? defaultPreferences.selectedProvider });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, [accountStorageKey]);

  useEffect(() => {
    if (!hydrated || !accountStorageKey) return;
    AsyncStorage.setItem(accountStorageKey, JSON.stringify({ messages, memories, approvals, ownerRequests, preferences })).catch(() => undefined);
  }, [accountStorageKey, approvals, hydrated, memories, messages, ownerRequests, preferences]);

  const value = useMemo<RebelState>(
    () => ({
      hydrated,
      messages,
      memories,
      sources,
      approvals,
      ownerRequests,
      preferences,
      addMessage: (message) => setMessages((current) => [...current, { ...message, id: uid("msg"), createdAt: new Date().toISOString() }]),
      addMemory: (memory) => setMemories((current) => [{ ...memory, id: uid("mem"), createdAt: new Date().toISOString() }, ...current]),
      removeMemory: (id) => setMemories((current) => current.filter((memory) => memory.id !== id)),
      addApproval: (approval) => setApprovals((current) => [{ ...approval, id: uid("apr"), createdAt: new Date().toISOString(), status: "بانتظار قرارك" }, ...current]),
      approve: (id) => setApprovals((current) => current.map((approval) => {
        if (approval.id !== id || approval.status !== "بانتظار قرارك") return approval;
        if (approval.memory) {
          setMemories((existing) => [{ ...approval.memory!, id: uid("mem"), createdAt: new Date().toISOString(), source: "موافقة المستخدم" }, ...existing]);
        }
        return { ...approval, status: "تمت الموافقة" };
      })),
      reject: (id) => setApprovals((current) => current.map((approval) => approval.id === id ? { ...approval, status: "تم الرفض" } : approval)),
      addOwnerRequest: (request) => setOwnerRequests((current) => [{ id: uid("owner"), request, createdAt: new Date().toISOString(), status: "مقترح للمراجعة" }, ...current]),
      updatePreferences: (changes) => setPreferences((current) => ({ ...current, ...changes })),
      clearMessages: () => setMessages(starterMessages),
      clearMemories: () => setMemories([]),
    }),
    [approvals, hydrated, memories, messages, ownerRequests, preferences, sources],
  );

  return <RebelContext.Provider value={value}>{children}</RebelContext.Provider>;
}

export function useRebelStore() {
  const context = useContext(RebelContext);
  if (!context) throw new Error("useRebelStore must be used inside RebelStoreProvider");
  return context;
}
