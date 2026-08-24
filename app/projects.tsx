import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { useRebelSession } from "@/lib/rebel-session";
import { useRebelStore } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

type Project = { id: number; name: string; description: string | null; instructions: string | null; updatedAt: Date };

export default function ProjectsScreen() {
  const router = useRouter();
  const { session, loading } = useRebelSession();
  const { preferences, updatePreferences } = useRebelStore();
  const projects = trpc.cloud.projects.list.useQuery(undefined, { enabled: Boolean(session) });
  const createProject = trpc.cloud.projects.create.useMutation({ onSuccess: () => projects.refetch() });
  const updateProject = trpc.cloud.projects.update.useMutation({ onSuccess: () => projects.refetch() });
  const deleteProject = trpc.cloud.projects.delete.useMutation({ onSuccess: () => projects.refetch() });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const pending = createProject.isPending || updateProject.isPending;

  useEffect(() => {
    if (!loading && !session) router.replace("/login" as never);
  }, [loading, router, session]);

  if (loading || !session) return <ScreenContainer className="items-center justify-center px-6" containerClassName="bg-background"><Text style={styles.gateText}>{loading ? "جارٍ التحقق من الجلسة…" : "يتم تحويلك إلى تسجيل الدخول…"}</Text></ScreenContainer>;

  const reset = () => { setName(""); setDescription(""); setInstructions(""); setEditingId(null); };
  const save = async () => {
    if (!name.trim() || pending) return;
    try {
      if (editingId) {
        await updateProject.mutateAsync({ projectId: editingId, name: name.trim(), description: description.trim() || null, instructions: instructions.trim() || null });
      } else {
        await createProject.mutateAsync({ name: name.trim(), description: description.trim() || undefined, instructions: instructions.trim() || undefined });
      }
      reset();
      haptic.success();
    } catch {
      Alert.alert("تعذر حفظ المشروع", "تحقق من اتصالك ثم أعد المحاولة.");
      haptic.warning();
    }
  };
  const select = (project: Project) => {
    updatePreferences({ activeProjectId: project.id, temporaryChat: false });
    haptic.success();
    router.replace("/(tabs)" as never);
  };
  const edit = (project: Project) => {
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.description ?? "");
    setInstructions(project.instructions ?? "");
  };
  const remove = (project: Project) => Alert.alert("حذف المشروع؟", "ستبقى محادثاته وذكرياته في حسابك، لكنها لن تكون مرتبطة بهذا المشروع بعد الحذف. أما دفتر الأدلة الخاص به فسيُحذف.", [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: async () => {
      try {
        await deleteProject.mutateAsync({ projectId: project.id });
        if (preferences.activeProjectId === project.id) updatePreferences({ activeProjectId: undefined });
        if (editingId === project.id) reset();
        haptic.medium();
      } catch { Alert.alert("تعذر الحذف", "تعذر حذف المشروع الآن."); }
    } },
  ]);
  const renderProject = ({ item }: { item: Project }) => {
    const selected = preferences.activeProjectId === item.id;
    return <View style={[styles.projectCard, selected && styles.projectSelected]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => select(item)} style={({ pressed }) => [styles.projectSelect, pressed && styles.pressed]}>
        <View style={[styles.projectIcon, selected && styles.projectIconSelected]}><IconSymbol name="folder.fill" size={22} color={selected ? "#FFFFFF" : "#2563EB"} /></View>
        <View style={styles.projectCopy}><Text style={styles.projectName}>{item.name}</Text><Text style={styles.projectDescription}>{item.description || "مساحة منظمة لمحادثاتك وذكرياتك وتعليماتك."}</Text>{item.instructions ? <Text style={styles.instructions}>تعليمات مفعلة للمشروع</Text> : null}</View>
        {selected ? <IconSymbol name="checkmark.seal.fill" size={21} color="#2563EB" /> : <IconSymbol name="chevron.right" size={20} color="#92929A" />}
      </Pressable>
      <View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/artifacts", params: { projectId: String(item.id) } } as never)} style={styles.smallAction}><IconSymbol name="paperplane.fill" size={16} color="#7C3AED" /><Text style={[styles.smallActionText, styles.artifactText]}>المخرجات</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/evidence", params: { projectId: String(item.id) } } as never)} style={styles.smallAction}><IconSymbol name="checkmark.seal.fill" size={16} color="#16835D" /><Text style={[styles.smallActionText, styles.evidenceText]}>دفتر الأدلة</Text></Pressable><Pressable accessibilityRole="button" onPress={() => edit(item)} style={styles.smallAction}><IconSymbol name="pencil" size={16} color="#4D6FB2" /><Text style={styles.smallActionText}>تعديل</Text></Pressable><Pressable accessibilityRole="button" onPress={() => remove(item)} style={styles.smallAction}><IconSymbol name="trash.fill" size={16} color="#B34A5C" /><Text style={[styles.smallActionText, styles.deleteText]}>حذف</Text></Pressable></View>
    </View>;
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={styles.back}><IconSymbol name="chevron.right" size={24} color="#19191C" /></Pressable><View><Text style={styles.title}>Rebel Projects</Text><Text style={styles.subtitle}>سياق منفصل للعمل أو الدراسة أو أي هدف مهم</Text></View><View style={styles.placeholder} /></View>
    <FlatList data={(projects.data ?? []) as Project[]} renderItem={renderProject} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListHeaderComponent={<View style={styles.form}>
      <Text style={styles.formTitle}>{editingId ? "تعديل المشروع" : "مشروع جديد"}</Text>
      <Text style={styles.formNote}>المشروع ينظم المحادثات والذكريات، ولا يرفع ملفات أو يربط خدمات خارجية تلقائياً.</Text>
      <TextInput value={name} onChangeText={setName} placeholder="اسم المشروع" placeholderTextColor="#94949C" style={styles.input} textAlign="right" accessibilityLabel="اسم المشروع" returnKeyType="next" />
      <TextInput value={description} onChangeText={setDescription} placeholder="وصف مختصر اختياري" placeholderTextColor="#94949C" style={styles.input} textAlign="right" accessibilityLabel="وصف المشروع" />
      <TextInput value={instructions} onChangeText={setInstructions} placeholder="تعليمات لهذا المشروع، مثال: اشرح باللغة العربية وبنقاط واضحة" placeholderTextColor="#94949C" style={[styles.input, styles.instructionsInput]} textAlign="right" multiline accessibilityLabel="تعليمات المشروع" />
      <View style={styles.formActions}><Pressable accessibilityRole="button" onPress={save} disabled={!name.trim() || pending} style={({ pressed }) => [styles.saveButton, (!name.trim() || pending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveText}>{pending ? "جارٍ الحفظ…" : editingId ? "حفظ التعديل" : "إنشاء المشروع"}</Text></Pressable>{editingId ? <Pressable accessibilityRole="button" onPress={reset} style={styles.cancelButton}><Text style={styles.cancelText}>إلغاء</Text></Pressable> : null}</View>
    </View>} ListEmptyComponent={<View style={styles.empty}><IconSymbol name="folder.fill" size={28} color="#9CB8F2" /><Text style={styles.emptyTitle}>لا يوجد مشروع نشط بعد</Text><Text style={styles.emptyText}>أنشئ مشروعاً لتنظيم سياق منفصل، أو استخدم Rebel كالمعتاد من دون مشروع.</Text></View>} />
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({
  gateText: { color: "#74747C", fontSize: 14, textAlign: "center" }, page: { flex: 1, paddingTop: 8 }, header: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E8EB" }, title: { color: "#17171A", fontSize: 22, fontWeight: "900", textAlign: "center" }, subtitle: { color: "#777780", fontSize: 10, textAlign: "center", marginTop: 3 }, placeholder: { width: 44 }, list: { gap: 10, paddingBottom: 28 }, form: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 18, padding: 14, gap: 10, marginBottom: 14 }, formTitle: { color: "#28282E", fontSize: 16, fontWeight: "900", textAlign: "right" }, formNote: { color: "#74747C", fontSize: 11, textAlign: "right", lineHeight: 17 }, input: { minHeight: 44, color: "#28282E", fontSize: 13, borderWidth: 1, borderColor: "#E3E3E7", borderRadius: 11, paddingHorizontal: 11, backgroundColor: "#FBFBFC" }, instructionsInput: { minHeight: 72, paddingTop: 10, lineHeight: 19 }, formActions: { flexDirection: "row-reverse", gap: 9 }, saveButton: { flex: 1, borderRadius: 11, paddingVertical: 12, alignItems: "center", backgroundColor: "#2563EB" }, saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, cancelButton: { borderRadius: 11, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "#F0F0F3" }, cancelText: { color: "#5E5E66", fontWeight: "800", fontSize: 12 }, projectCard: { backgroundColor: "#FFFFFF", borderColor: "#E7E7EA", borderWidth: 1, borderRadius: 17, overflow: "hidden" }, projectSelected: { backgroundColor: "#F4F7FF", borderColor: "#9DBDFF" }, projectSelect: { flexDirection: "row-reverse", alignItems: "center", gap: 11, padding: 13 }, projectIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1FF" }, projectIconSelected: { backgroundColor: "#2563EB" }, projectCopy: { flex: 1, gap: 4 }, projectName: { color: "#29292F", fontSize: 15, fontWeight: "900", textAlign: "right" }, projectDescription: { color: "#72727B", fontSize: 11, lineHeight: 17, textAlign: "right" }, instructions: { color: "#2563EB", fontSize: 10, fontWeight: "800", textAlign: "right" }, cardActions: { flexDirection: "row-reverse", justifyContent: "flex-start", flexWrap: "wrap", gap: 14, paddingHorizontal: 13, paddingBottom: 11 }, smallAction: { flexDirection: "row-reverse", alignItems: "center", gap: 5 }, smallActionText: { color: "#4D6FB2", fontSize: 11, fontWeight: "800" }, artifactText: { color: "#7C3AED" }, evidenceText: { color: "#16835D" }, deleteText: { color: "#B34A5C" }, empty: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7E7EA", alignItems: "center", padding: 28, gap: 8 }, emptyTitle: { color: "#34343A", fontWeight: "900", fontSize: 15 }, emptyText: { color: "#777780", lineHeight: 19, textAlign: "center", fontSize: 12 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
