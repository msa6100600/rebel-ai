import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { rebelGpts, useRebelStore, type RebelGptProfile } from "@/lib/rebel-store";

export default function GptsScreen() {
  const router = useRouter();
  const { preferences, updatePreferences } = useRebelStore();
  const selectGpt = (gpt: RebelGptProfile) => { updatePreferences({ selectedGptId: gpt.id }); haptic.success(); router.replace("/(tabs)" as never); };
  const renderGpt = ({ item }: { item: RebelGptProfile }) => {
    const selected = preferences.selectedGptId === item.id;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectGpt(item)} style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: item.color }]}><IconSymbol name={item.icon} size={25} color="#FFFFFF" /></View>
      <View style={styles.copy}><View style={styles.nameLine}><Text style={styles.category}>{item.category}</Text><Text style={styles.name}>{item.name}</Text></View><Text style={styles.description}>{item.description}</Text></View>
      {selected ? <IconSymbol name="checkmark.seal.fill" size={22} color="#2563EB" /> : <IconSymbol name="chevron.right" size={20} color="#A0A0A8" />}
    </Pressable>;
  };
  return <ScreenContainer className="px-5" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={styles.back}><IconSymbol name="chevron.right" size={24} color="#19191C" /></Pressable><Text style={styles.title}>Rebel GPTs</Text><View style={styles.placeholder} /></View>
    <View style={styles.search}><IconSymbol name="magnifyingglass" size={21} color="#686871" /><Text style={styles.searchText}>ابحث في Rebel GPTs</Text></View>
    <View style={styles.tabs}><Text style={styles.tab}>الأكثر استخداماً</Text><Text style={styles.activeTab}>أفضل الاختيارات</Text><Text style={styles.tab}>مميزة</Text></View>
    <Text style={styles.sectionTitle}>مساعدون متخصصون</Text>
    <FlatList data={rebelGpts} renderItem={renderGpt} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />
  </View></ScreenContainer>;
}
const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 8 }, header: { height: 52, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, title: { fontSize: 27, fontWeight: "800", color: "#17171A" }, placeholder: { width: 44 }, search: { height: 48, borderRadius: 24, backgroundColor: "#ECECEE", flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 15, gap: 9, marginBottom: 18 }, searchText: { color: "#777780", fontSize: 15 }, tabs: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 26, paddingHorizontal: 3 }, tab: { color: "#777780", fontSize: 14, fontWeight: "700" }, activeTab: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", backgroundColor: "#19191C", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: -8 }, sectionTitle: { color: "#1F1F23", fontSize: 19, fontWeight: "800", textAlign: "right", marginBottom: 10 }, list: { gap: 8, paddingBottom: 25 }, card: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E8EB", padding: 13, borderRadius: 18 }, selected: { borderColor: "#98B9FF", backgroundColor: "#F5F8FF" }, icon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 5 }, nameLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, name: { color: "#25252A", fontSize: 16, fontWeight: "800", textAlign: "right" }, category: { color: "#74747D", fontSize: 10, fontWeight: "700" }, description: { color: "#6F6F78", fontSize: 12, lineHeight: 18, textAlign: "right" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] } });
