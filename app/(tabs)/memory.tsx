import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { IconButton, ScreenHeading, SectionTitle, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";

type CloudMemoryCategory = "profile" | "preference" | "goal" | "project" | "decision" | "temporary";
type CloudMemory = { id: number; category: CloudMemoryCategory; title: string; content: string; approvedAt: Date; createdAt: Date };

const memoryCategories: { id: CloudMemoryCategory; label: string }[] = [
  { id: "profile", label: "معلومة شخصية" },
  { id: "preference", label: "تفضيل" },
  { id: "goal", label: "هدف" },
  { id: "project", label: "مشروع" },
  { id: "decision", label: "قرار" },
  { id: "temporary", label: "مؤقت" },
];

export default function MemoryScreen() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<CloudMemoryCategory>("profile");
  const memories = trpc.cloud.memories.list.useQuery({ search: query.trim() || undefined });
  const createMemory = trpc.cloud.memories.create.useMutation({ onSuccess: () => memories.refetch() });
  const deleteMemory = trpc.cloud.memories.delete.useMutation({ onSuccess: () => memories.refetch() });
  const add = async () => {
    if (!title.trim() || !content.trim() || createMemory.isPending) return;
    try {
      await createMemory.mutateAsync({ category, title: title.trim(), content: content.trim() });
      setTitle(""); setContent(""); haptic.success();
    } catch { Alert.alert("تعذر الحفظ", "لم تُحفظ المعلومة. تحقق من اتصالك ثم أعد المحاولة."); haptic.warning(); }
  };
  const renderMemory = ({ item }: { item: CloudMemory }) => <View style={styles.memoryCard}><View style={styles.cardTop}><IconButton icon="trash.fill" label={`حذف ${item.title}`} onPress={() => { deleteMemory.mutate({ memoryId: item.id }); haptic.medium(); }} /><StatusPill tone="primary" label={memoryCategories.find((value) => value.id === item.category)?.label ?? item.category} /></View><Text style={styles.memoryTitle}>{item.title}</Text><Text style={styles.memoryContent}>{item.content}</Text><Text style={styles.memoryMeta}>تم الحفظ بموافقتك · {new Date(item.approvedAt).toLocaleDateString("ar-EG")}</Text></View>;
  const memoryData = (memories.data ?? []) as CloudMemory[];
  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}><ScreenHeading eyebrow="PRIVATE CONTEXT" title="الذاكرة" action={<StatusPill tone="neutral" label={`${memoryData.length} عنصر`} />} /><Text style={styles.intro}>مساحة شخصية سحابية لما توافق أن يحتفظ به Rebel AI. ترتبط بحسابك وتستطيع حذفها أو البحث فيها في أي وقت.</Text><View style={styles.searchBox}><IconSymbol name="magnifyingglass" size={19} color="#777780" /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في الذاكرة" placeholderTextColor="#94949C" style={styles.searchInput} accessibilityLabel="بحث في الذاكرة" /></View><SectionTitle title="إضافة معلومة" detail="حفظ سحابي بموافقتك" /><View style={styles.addBox}><TextInput value={title} onChangeText={setTitle} placeholder="عنوان قصير" placeholderTextColor="#92929B" style={styles.titleInput} accessibilityLabel="عنوان المعلومة" /><TextInput value={content} onChangeText={setContent} placeholder="ما الذي تريد أن يتذكره Rebel AI؟" placeholderTextColor="#92929B" style={styles.contentInput} multiline accessibilityLabel="محتوى المعلومة" /><View style={styles.categoryRow}>{memoryCategories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.categoryChip, category === item.id && styles.categoryChipActive]}><Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>{item.label}</Text></Pressable>)}</View><Pressable accessibilityRole="button" onPress={add} disabled={!title.trim() || !content.trim() || createMemory.isPending} style={({ pressed }) => [styles.addButton, (!title.trim() || !content.trim() || createMemory.isPending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.addButtonText}>{createMemory.isPending ? "جارٍ الحفظ…" : "أوافق على حفظها في ذاكرتي"}</Text></Pressable></View><SectionTitle title="العناصر المحفوظة" detail={`${memoryData.length} نتيجة`} /><FlatList data={memoryData} renderItem={renderMemory} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>ذاكرتك فارغة حتى الآن</Text><Text style={styles.emptyText}>أضف معلومة بنفسك؛ لا تُحفظ الذكريات السحابية تلقائياً من المحادثات.</Text></View>} /></View></ScreenContainer>;
}
const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10 }, intro: { color: "#6E6E77", fontSize: 14, lineHeight: 22, textAlign: "right", marginBottom: 15 }, searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", padding: 10, borderRadius: 15, marginBottom: 20 }, searchInput: { flex: 1, color: "#25252B", fontSize: 14, textAlign: "right", minHeight: 30 }, addBox: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", padding: 14, borderRadius: 17, gap: 10, marginBottom: 20 }, titleInput: { color: "#25252B", fontSize: 14, textAlign: "right", borderBottomWidth: 1, borderBottomColor: "#ECECEF", paddingVertical: 8 }, contentInput: { color: "#25252B", fontSize: 14, textAlign: "right", minHeight: 56, lineHeight: 21 }, categoryRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, paddingTop: 2 }, categoryChip: { borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#FAFAFB" }, categoryChipActive: { backgroundColor: "#EAF1FF", borderColor: "#2563EB" }, categoryText: { fontSize: 11, color: "#66666E" }, categoryTextActive: { color: "#1E5CC9", fontWeight: "800" }, addButton: { backgroundColor: "#2563EB", paddingVertical: 12, alignItems: "center", borderRadius: 12 }, addButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] }, list: { gap: 10, paddingBottom: 24 }, memoryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#E7E7EA", gap: 8 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, memoryTitle: { color: "#28282E", fontSize: 16, fontWeight: "800", textAlign: "right" }, memoryContent: { color: "#5C5C65", fontSize: 13, lineHeight: 20, textAlign: "right" }, memoryMeta: { color: "#92929A", fontSize: 10, textAlign: "right" }, empty: { alignItems: "center", padding: 30, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7E7EA" }, emptyTitle: { color: "#303037", fontWeight: "800", fontSize: 16 }, emptyText: { color: "#777780", fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 7 } });
