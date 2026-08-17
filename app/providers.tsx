import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelStore } from "@/lib/rebel-store";

type Provider = { id: string; name: string; models: string; state: "متصل" | "متاح عند الربط"; connected?: boolean; modelId?: "gpt-5" | "gpt-5-mini" | "claude-sonnet-4-6" | "gemini-3.1-pro-preview"; note: string };

const providers: Provider[] = [
  { id: "gpt-5", name: "Rebel Core · GPT-5", models: "GPT-5", state: "متصل", connected: true, modelId: "gpt-5", note: "الاختيار الافتراضي للتحليل المعمّق والاستنتاج." },
  { id: "gpt-5-mini", name: "Rebel Core · GPT-5 mini", models: "GPT-5 mini", state: "متصل", connected: true, modelId: "gpt-5-mini", note: "سريع وملائم للمهام اليومية والمحادثات القصيرة." },
  { id: "claude", name: "Rebel Core · Claude Sonnet", models: "Claude Sonnet 4.6", state: "متصل", connected: true, modelId: "claude-sonnet-4-6", note: "خيار متوازن للكتابة والتحليل والبرمجة." },
  { id: "gemini", name: "Rebel Core · Gemini Pro", models: "Gemini 3.1 Pro", state: "متصل", connected: true, modelId: "gemini-3.1-pro-preview", note: "خيار متعدد الوسائط وسياق طويل." },
  { id: "openai", name: "OpenAI API", models: "GPT series", state: "متاح عند الربط", note: "يتطلب مفتاح API وحساباً لدى OpenAI قبل تشغيله مباشرة." },
  { id: "anthropic", name: "Anthropic API", models: "Claude series", state: "متاح عند الربط", note: "يتطلب مفتاح API وترخيصاً من Anthropic." },
  { id: "google", name: "Google AI", models: "Gemini series", state: "متاح عند الربط", note: "يتطلب مشروعاً ومفتاحاً من Google AI." },
  { id: "mistral", name: "Mistral AI", models: "Mistral models", state: "متاح عند الربط", note: "يتطلب مفتاح API خاصاً بالمزوّد." },
  { id: "cohere", name: "Cohere", models: "Command models", state: "متاح عند الربط", note: "يتطلب مفتاح API خاصاً بالمزوّد." },
  { id: "deepseek", name: "DeepSeek", models: "DeepSeek models", state: "متاح عند الربط", note: "يتطلب مفتاح API خاصاً بالمزوّد." },
];

export default function ProvidersScreen() {
  const router = useRouter();
  const { preferences, updatePreferences } = useRebelStore();
  const selectProvider = (provider: Provider) => {
    if (!provider.connected || !provider.modelId) {
      Alert.alert("يتطلب ربطاً خارجياً", `${provider.name} غير متصل بعد. يحتاج هذا المزوّد مفتاح API وترخيصاً يقدمه مالك الحساب قبل استخدامه.`);
      return;
    }
    updatePreferences({ selectedProvider: "rebel-core", selectedModel: provider.modelId });
    haptic.success();
  };
  const renderProvider = ({ item }: { item: Provider }) => {
    const selected = item.modelId === preferences.selectedModel;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectProvider(item)} style={({ pressed }) => [styles.card, selected && styles.selectedCard, pressed && styles.pressed]}><View style={styles.top}><StatusPill tone={item.connected ? "success" : "warning"} label={item.state} /><IconSymbol name={selected ? "checkmark.seal.fill" : "sparkles"} size={21} color={selected ? "#57E4AC" : "#8E7BFF"} /></View><Text style={styles.name}>{item.name}</Text><Text style={styles.models}>{item.models}</Text><Text style={styles.note}>{item.note}</Text></Pressable>;
  };
  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}><ScreenHeading eyebrow="ONE PLACE FOR AI SERVICES" title="خدمات الذكاء" action={<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.close}><IconSymbol name="xmark" size={20} color="#DCE4FA" /></Pressable>} /><Text style={styles.intro}>اختر نموذج المحرك المدمج للمحادثة الآن. تظهر الخدمات الخارجية لتكون جاهزة للربط عند توفير مفاتيحك وتراخيصها؛ لا يتم استخدام أي خدمة خارجية دون تفويض صريح.</Text><View style={styles.active}><Text style={styles.activeValue}>{preferences.selectedModel}</Text><Text style={styles.activeLabel}>المحرك النشط</Text></View><FlatList data={providers} renderItem={renderProvider} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10 }, close: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: "#202B49", borderWidth: 1, borderColor: "#34466F" }, intro: { color: "#B4C0E0", fontSize: 13, lineHeight: 21, textAlign: "right", marginBottom: 14 }, active: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 13, borderRadius: 15, backgroundColor: "#1A2A48", borderWidth: 1, borderColor: "#3B5A91", marginBottom: 14 }, activeLabel: { color: "#AFC0E9", fontSize: 12, fontWeight: "800" }, activeValue: { color: "#6DE5FF", fontSize: 13, fontWeight: "900" }, list: { gap: 10, paddingBottom: 28 }, card: { backgroundColor: "#121A31", borderWidth: 1, borderColor: "#2B3B62", padding: 14, borderRadius: 17, gap: 6 }, selectedCard: { backgroundColor: "#172E38", borderColor: "#3E967E" }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, name: { color: "#F5F7FF", fontSize: 16, fontWeight: "900", textAlign: "right" }, models: { color: "#7FE4FF", fontSize: 12, fontWeight: "700", textAlign: "right" }, note: { color: "#AAB6D7", fontSize: 12, lineHeight: 18, textAlign: "right" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] } });
