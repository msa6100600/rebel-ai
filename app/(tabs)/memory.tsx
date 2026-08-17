import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { IconButton, ScreenHeading, SectionTitle, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelStore, type MemoryItem } from "@/lib/rebel-store";

export default function MemoryScreen() {
  const { memories, addMemory, removeMemory } = useRebelStore();
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const filtered = useMemo(() => memories.filter((memory) => `${memory.title} ${memory.content} ${memory.category}`.toLowerCase().includes(query.trim().toLowerCase())), [memories, query]);

  const add = () => {
    if (!title.trim() || !content.trim()) return;
    addMemory({ title: title.trim(), content: content.trim(), category: "سياق", source: "إضافة يدوية" });
    setTitle("");
    setContent("");
    haptic.success();
  };

  const renderMemory = ({ item }: { item: MemoryItem }) => (
    <View style={styles.memoryCard}>
      <View style={styles.cardTop}><IconButton icon="trash.fill" label={`حذف ${item.title}`} onPress={() => { removeMemory(item.id); haptic.medium(); }} /><StatusPill tone="primary" label={item.category} /></View>
      <Text style={styles.memoryTitle}>{item.title}</Text>
      <Text style={styles.memoryContent}>{item.content}</Text>
      <Text style={styles.memoryMeta}>{item.source} · {new Date(item.createdAt).toLocaleDateString("ar-EG")}</Text>
    </View>
  );

  return (
    <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background">
      <View style={styles.page}>
        <ScreenHeading eyebrow="YOUR PERSISTENT CONTEXT" title="الذاكرة" action={<StatusPill tone="success" label={`${memories.length} محفوظ`} />} />
        <Text style={styles.intro}>هذه الذاكرة على جهازك. يمكنك حذف أي عنصر، ولا تحفظ الاقتراحات القادمة من المساعد إلا بعد موافقتك.</Text>
        <View style={styles.searchBox}><IconButton icon="magnifyingglass" label="بحث في الذاكرة" onPress={() => undefined} /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في الذاكرة…" placeholderTextColor="#7F8AAE" style={styles.searchInput} accessibilityLabel="بحث في الذاكرة" /></View>
        <SectionTitle title="إضافة معلومة" detail="تُحفظ محلياً" />
        <View style={styles.addBox}>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان قصير" placeholderTextColor="#8190B8" style={styles.titleInput} accessibilityLabel="عنوان المعلومة" />
          <TextInput value={content} onChangeText={setContent} placeholder="ما الذي تريد أن يتذكره Rebel AI؟" placeholderTextColor="#8190B8" style={styles.contentInput} multiline accessibilityLabel="محتوى المعلومة" />
          <Pressable onPress={add} disabled={!title.trim() || !content.trim()} style={({ pressed }) => [styles.addButton, (!title.trim() || !content.trim()) && styles.disabled, pressed && styles.pressed]}><Text style={styles.addButtonText}>حفظ في الذاكرة</Text></Pressable>
        </View>
        <SectionTitle title="العناصر المحفوظة" detail={`${filtered.length} نتيجة`} />
        <FlatList data={filtered} renderItem={renderMemory} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد عناصر مطابقة</Text><Text style={styles.emptyText}>أضف معلومة بنفسك أو وافق على اقتراح تعلّم من شاشة الموافقات.</Text></View>} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 10 }, intro: { color: "#AEB7D6", fontSize: 14, lineHeight: 22, textAlign: "right", marginBottom: 14 },
  searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#121A31", borderWidth: 1, borderColor: "#2B3B62", padding: 8, borderRadius: 16, marginBottom: 18 },
  searchInput: { flex: 1, color: "#F5F7FF", fontSize: 14, textAlign: "right", minHeight: 36 },
  addBox: { backgroundColor: "#151E38", borderWidth: 1, borderColor: "#29395D", padding: 12, borderRadius: 17, gap: 9, marginBottom: 18 },
  titleInput: { color: "#F5F7FF", fontSize: 14, textAlign: "right", borderBottomWidth: 1, borderBottomColor: "#2C3D64", paddingVertical: 7 },
  contentInput: { color: "#F5F7FF", fontSize: 14, textAlign: "right", minHeight: 54, lineHeight: 21 },
  addButton: { backgroundColor: "#7C5CFC", paddingVertical: 11, alignItems: "center", borderRadius: 12 }, addButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  list: { gap: 10, paddingBottom: 24 }, memoryCard: { backgroundColor: "#121A31", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#29395D", gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, memoryTitle: { color: "#F5F7FF", fontSize: 16, fontWeight: "800", textAlign: "right" }, memoryContent: { color: "#C0C9E4", fontSize: 13, lineHeight: 20, textAlign: "right" }, memoryMeta: { color: "#7482AA", fontSize: 10, textAlign: "right" },
  empty: { alignItems: "center", padding: 28, backgroundColor: "#121A31", borderRadius: 16 }, emptyTitle: { color: "#F5F7FF", fontWeight: "800", fontSize: 16 }, emptyText: { color: "#AEB7D6", fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 7 },
});
