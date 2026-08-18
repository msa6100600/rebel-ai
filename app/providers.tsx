import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { freeModels, useRebelStore, type FreeModelId } from "@/lib/rebel-store";

export default function ProvidersScreen() {
  const router = useRouter();
  const { preferences, updatePreferences } = useRebelStore();
  const selectModel = (id: FreeModelId) => {
    const model = freeModels.find((item) => item.id === id);
    if (!model) return;
    updatePreferences({ selectedProvider: model.provider, selectedModel: model.id });
    haptic.success();
  };
  const renderModel = ({ item }: { item: (typeof freeModels)[number] }) => {
    const selected = item.id === preferences.selectedModel;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectModel(item.id)} style={({ pressed }) => [styles.card, selected && styles.selectedCard, pressed && styles.pressed]}><View style={styles.top}><StatusPill tone="success" label={selected ? "النموذج النشط" : "متاح"} /><IconSymbol name={selected ? "checkmark.seal.fill" : "sparkles"} size={21} color={selected ? "#16835D" : "#2563EB"} /></View><Text style={styles.name}>{item.name}</Text><Text style={styles.provider}>{item.provider === "gemini" ? "Google AI Studio" : item.provider === "groq" ? "Groq" : "Mistral AI"}</Text><Text style={styles.note}>{item.description}</Text><View style={styles.freeRow}><IconSymbol name="checkmark.seal.fill" size={15} color="#16835D" /><Text style={styles.freeText}>مسار استخدام مجاني فقط — لا يوجد نموذج مدفوع بديل.</Text></View></Pressable>;
  };
  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}><ScreenHeading eyebrow="FREE MODEL SELECTOR" title="اختر النموذج" action={<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.close}><IconSymbol name="xmark" size={20} color="#2563EB" /></Pressable>} /><Text style={styles.intro}>اختر أحد النماذج الثلاثة فقط. يبدأ Rebel AI بـ Gemini Flash، ثم ينتقل بهدوء إلى Groq ثم Mistral عند بلوغ حد الاستخدام المجاني؛ ولا يتحول أبداً إلى خدمة مدفوعة.</Text><View style={styles.active}><Text style={styles.activeValue}>{freeModels.find((item) => item.id === preferences.selectedModel)?.name}</Text><Text style={styles.activeLabel}>النموذج النشط</Text></View><FlatList data={freeModels} renderItem={renderModel} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} /></View></ScreenContainer>;
}

const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10 }, close: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA" }, intro: { color: "#6C6C75", fontSize: 13, lineHeight: 21, textAlign: "right", marginBottom: 14 }, active: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 13, borderRadius: 15, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#D7E6FF", marginBottom: 14 }, activeLabel: { color: "#56627B", fontSize: 12, fontWeight: "800" }, activeValue: { color: "#2563EB", fontSize: 13, fontWeight: "900", textAlign: "right", flex: 1 }, list: { gap: 10, paddingBottom: 28 }, card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", padding: 14, borderRadius: 17, gap: 6 }, selectedCard: { backgroundColor: "#F1F7F4", borderColor: "#B9E0CD" }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, name: { color: "#29292F", fontSize: 16, fontWeight: "900", textAlign: "right" }, provider: { color: "#2563EB", fontSize: 12, fontWeight: "700", textAlign: "right" }, note: { color: "#707079", fontSize: 12, lineHeight: 18, textAlign: "right" }, freeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 4 }, freeText: { color: "#16835D", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "right" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] } });
