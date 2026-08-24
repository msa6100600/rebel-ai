import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { useRebelSession } from "@/lib/rebel-session";
import { trpc } from "@/lib/trpc";

type EvidenceKind = "claim" | "evidence" | "assumption" | "decision";
type EvidenceStatus = "unverified" | "reviewing" | "verified" | "rejected";
type EvidenceItem = { id: number; kind: EvidenceKind; title: string; content: string; confidence: number; verificationStatus: EvidenceStatus };

const kinds: { value: EvidenceKind; label: string; tint: string }[] = [
  { value: "claim", label: "ادعاء", tint: "#2563EB" },
  { value: "evidence", label: "دليل", tint: "#16835D" },
  { value: "assumption", label: "افتراض", tint: "#A16207" },
  { value: "decision", label: "قرار", tint: "#7C3AED" },
];
const statuses: { value: EvidenceStatus; label: string }[] = [
  { value: "unverified", label: "غير متحقق" },
  { value: "reviewing", label: "قيد المراجعة" },
  { value: "verified", label: "متحقق" },
  { value: "rejected", label: "مرفوض" },
];

export default function EvidenceScreen() {
  const router = useRouter();
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const projectId = Number(projectIdParam);
  const { session, loading } = useRebelSession();
  const enabled = Boolean(session && Number.isInteger(projectId) && projectId > 0);
  const evidence = trpc.cloud.evidence.list.useQuery({ projectId }, { enabled });
  const createItem = trpc.cloud.evidence.create.useMutation({ onSuccess: () => evidence.refetch() });
  const updateItem = trpc.cloud.evidence.update.useMutation({ onSuccess: () => evidence.refetch() });
  const deleteItem = trpc.cloud.evidence.delete.useMutation({ onSuccess: () => evidence.refetch() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kind, setKind] = useState<EvidenceKind>("claim");
  const [status, setStatus] = useState<EvidenceStatus>("unverified");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confidence, setConfidence] = useState("50");
  const pending = createItem.isPending || updateItem.isPending;

  useEffect(() => {
    if (!loading && !session) router.replace("/login" as never);
  }, [loading, router, session]);

  const reset = () => { setEditingId(null); setKind("claim"); setStatus("unverified"); setTitle(""); setContent(""); setConfidence("50"); };
  const save = async () => {
    const confidenceNumber = Math.max(0, Math.min(100, Number.parseInt(confidence, 10) || 0));
    if (!title.trim() || !content.trim() || !enabled || pending) return;
    try {
      if (editingId) await updateItem.mutateAsync({ evidenceId: editingId, kind, title: title.trim(), content: content.trim(), confidence: confidenceNumber, verificationStatus: status });
      else await createItem.mutateAsync({ projectId, kind, title: title.trim(), content: content.trim(), confidence: confidenceNumber, verificationStatus: status });
      reset(); haptic.success();
    } catch { Alert.alert("تعذر حفظ العنصر", "تحقق من اتصالك ومن المشروع ثم أعد المحاولة."); haptic.warning(); }
  };
  const edit = (item: EvidenceItem) => { setEditingId(item.id); setKind(item.kind); setStatus(item.verificationStatus); setTitle(item.title); setContent(item.content); setConfidence(String(item.confidence)); };
  const remove = (item: EvidenceItem) => Alert.alert("حذف عنصر الدليل؟", "لن يمكن استعادته من دفتر هذا المشروع.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: async () => { try { await deleteItem.mutateAsync({ evidenceId: item.id }); if (editingId === item.id) reset(); haptic.medium(); } catch { Alert.alert("تعذر الحذف", "تعذر حذف العنصر الآن."); } } }]);

  if (loading || !session) return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.gate}>{loading ? "جارٍ التحقق من الجلسة…" : "يتم تحويلك إلى تسجيل الدخول…"}</Text></ScreenContainer>;
  if (!enabled) return <ScreenContainer className="items-center justify-center px-6"><Text style={styles.gate}>اختر مشروعاً أولاً لفتح دفتر الأدلة.</Text><Pressable onPress={() => router.replace("/projects" as never)} style={styles.backButton}><Text style={styles.backText}>المشاريع</Text></Pressable></ScreenContainer>;

  const renderItem = ({ item }: { item: EvidenceItem }) => {
    const meta = kinds.find((entry) => entry.value === item.kind)!;
    const statusLabel = statuses.find((entry) => entry.value === item.verificationStatus)?.label ?? item.verificationStatus;
    return <View style={styles.itemCard}><View style={styles.itemTop}><View style={[styles.kindBadge, { backgroundColor: `${meta.tint}14` }]}><Text style={[styles.kindText, { color: meta.tint }]}>{meta.label}</Text></View><Text style={styles.itemTitle}>{item.title}</Text></View><Text style={styles.itemContent}>{item.content}</Text><View style={styles.itemMeta}><Text style={styles.metaText}>الثقة: {item.confidence}%</Text><Text style={styles.metaText}>{statusLabel}</Text></View><View style={styles.itemActions}><Pressable onPress={() => edit(item)} style={styles.inlineAction}><Text style={styles.editText}>تعديل</Text></Pressable><Pressable onPress={() => remove(item)} style={styles.inlineAction}><Text style={styles.deleteText}>حذف</Text></Pressable></View></View>;
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><View style={styles.page}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><IconSymbol name="chevron.right" size={23} color="#202026" /></Pressable><View><Text style={styles.title}>دفتر الأدلة</Text><Text style={styles.subtitle}>راجع ما تدعمه الأدلة وما يزال افتراضاً قبل اتخاذ القرار</Text></View><View style={styles.spacer} /></View><FlatList data={(evidence.data ?? []) as EvidenceItem[]} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View style={styles.form}><Text style={styles.formTitle}>{editingId ? "تعديل العنصر" : "إضافة عنصر"}</Text><Text style={styles.note}>هذا دفتر قرار للمشروع. لا يجلب Rebel مصدراً خارجياً من تلقاء نفسه.</Text><View style={styles.chips}>{kinds.map((entry) => <Pressable key={entry.value} onPress={() => setKind(entry.value)} style={[styles.chip, kind === entry.value && { backgroundColor: entry.tint, borderColor: entry.tint }]}><Text style={[styles.chipText, kind === entry.value && styles.chipTextActive]}>{entry.label}</Text></Pressable>)}</View><TextInput value={title} onChangeText={setTitle} placeholder="عنوان مختصر" placeholderTextColor="#94949C" style={styles.input} textAlign="right" /><TextInput value={content} onChangeText={setContent} placeholder="اكتب الدليل أو الافتراض أو القرار بوضوح" placeholderTextColor="#94949C" style={[styles.input, styles.contentInput]} textAlign="right" multiline /><View style={styles.row}><TextInput value={confidence} onChangeText={setConfidence} keyboardType="number-pad" maxLength={3} style={[styles.input, styles.confidence]} textAlign="center" /><View style={styles.statuses}>{statuses.map((entry) => <Pressable key={entry.value} onPress={() => setStatus(entry.value)} style={[styles.statusChip, status === entry.value && styles.statusChipActive]}><Text style={[styles.statusText, status === entry.value && styles.statusTextActive]}>{entry.label}</Text></Pressable>)}</View></View><View style={styles.formActions}><Pressable onPress={save} disabled={!title.trim() || !content.trim() || pending} style={[styles.saveButton, (!title.trim() || !content.trim() || pending) && styles.disabled]}><Text style={styles.saveText}>{pending ? "جارٍ الحفظ…" : editingId ? "حفظ التعديل" : "إضافة للدفتر"}</Text></Pressable>{editingId ? <Pressable onPress={reset} style={styles.cancelButton}><Text style={styles.cancelText}>إلغاء</Text></Pressable> : null}</View></View>} ListEmptyComponent={<View style={styles.empty}><IconSymbol name="checkmark.seal.fill" size={30} color="#94B9A7" /><Text style={styles.emptyTitle}>ابدأ بدليل واحد</Text><Text style={styles.emptyText}>أضف ادعاءً أو دليلاً أو افتراضاً، ثم راجع الثقة وحالة التحقق قبل الاعتماد عليه.</Text></View>} /></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 8 }, gate: { color: "#73737C", fontSize: 14, textAlign: "center" }, header: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E8EB" }, title: { color: "#17171A", fontSize: 22, fontWeight: "900", textAlign: "center" }, subtitle: { color: "#777780", fontSize: 10, textAlign: "center", marginTop: 3 }, spacer: { width: 44 }, list: { gap: 10, paddingBottom: 28 }, form: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 18, padding: 14, gap: 10, marginBottom: 14 }, formTitle: { color: "#28282E", fontSize: 16, fontWeight: "900", textAlign: "right" }, note: { color: "#64726B", fontSize: 11, lineHeight: 17, textAlign: "right", backgroundColor: "#EFF8F3", borderRadius: 10, padding: 9 }, chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, chip: { borderWidth: 1, borderColor: "#DFE1E6", backgroundColor: "#FAFAFB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, chipText: { color: "#62626B", fontSize: 11, fontWeight: "800" }, chipTextActive: { color: "#FFFFFF" }, input: { minHeight: 44, color: "#28282E", fontSize: 13, borderWidth: 1, borderColor: "#E3E3E7", borderRadius: 11, paddingHorizontal: 11, backgroundColor: "#FBFBFC" }, contentInput: { minHeight: 88, paddingTop: 10, lineHeight: 19 }, row: { flexDirection: "row-reverse", gap: 8, alignItems: "center" }, confidence: { width: 62, minHeight: 40, fontWeight: "900" }, statuses: { flex: 1, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "flex-start", gap: 6 }, statusChip: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, backgroundColor: "#F1F1F4" }, statusChipActive: { backgroundColor: "#E6F0FF" }, statusText: { color: "#72727C", fontSize: 10, fontWeight: "800" }, statusTextActive: { color: "#2563EB" }, formActions: { flexDirection: "row-reverse", gap: 9 }, saveButton: { flex: 1, borderRadius: 11, paddingVertical: 12, alignItems: "center", backgroundColor: "#2563EB" }, saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, cancelButton: { borderRadius: 11, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "#F0F0F3" }, cancelText: { color: "#5E5E66", fontWeight: "800", fontSize: 12 }, disabled: { opacity: 0.45 }, itemCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E7EA", borderRadius: 17, padding: 14, gap: 9 }, itemTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 }, kindBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 }, kindText: { fontSize: 10, fontWeight: "900" }, itemTitle: { flex: 1, color: "#26262C", fontSize: 15, fontWeight: "900", textAlign: "right" }, itemContent: { color: "#62626C", fontSize: 12, lineHeight: 19, textAlign: "right" }, itemMeta: { flexDirection: "row-reverse", gap: 12, justifyContent: "flex-start" }, metaText: { color: "#7C7C85", fontSize: 10, fontWeight: "700" }, itemActions: { flexDirection: "row-reverse", gap: 14 }, inlineAction: { paddingVertical: 3 }, editText: { color: "#2563EB", fontSize: 11, fontWeight: "900" }, deleteText: { color: "#B34A5C", fontSize: 11, fontWeight: "900" }, empty: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7E7EA", alignItems: "center", padding: 28, gap: 8 }, emptyTitle: { color: "#34343A", fontWeight: "900", fontSize: 15 }, emptyText: { color: "#777780", lineHeight: 19, textAlign: "center", fontSize: 12 }, backButton: { backgroundColor: "#2563EB", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 14 }, backText: { color: "#FFFFFF", fontWeight: "900" },
});
