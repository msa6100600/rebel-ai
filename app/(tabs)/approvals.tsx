import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, SectionTitle, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelStore, type ApprovalItem } from "@/lib/rebel-store";

export default function ApprovalsScreen() {
  const { approvals, approve, reject } = useRebelStore();
  const pending = approvals.filter((approval) => approval.status === "بانتظار قرارك").length;
  const renderApproval = ({ item }: { item: ApprovalItem }) => { const pendingItem = item.status === "بانتظار قرارك"; const tone = item.status === "تمت الموافقة" ? "success" : item.status === "تم الرفض" ? "neutral" : "warning"; return <View style={styles.card}><View style={styles.top}><StatusPill label={item.status} tone={tone} /><Text style={styles.type}>{item.type}</Text></View><Text style={styles.title}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text>{pendingItem ? <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => { reject(item.id); haptic.medium(); }} style={({ pressed }) => [styles.reject, pressed && styles.pressed]}><Text style={styles.rejectText}>رفض</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { approve(item.id); haptic.success(); }} style={({ pressed }) => [styles.approve, pressed && styles.pressed]}><IconSymbol name="checkmark.seal.fill" color="#FFFFFF" size={17} /><Text style={styles.approveText}>موافقة وحفظ</Text></Pressable></View> : null}</View>; };
  return (
    <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background">
      <View style={styles.page}>
        <ScreenHeading
          eyebrow="YOU DECIDE"
          title="الموافقات"
          action={<StatusPill tone={pending ? "warning" : "success"} label={pending ? `${pending} بانتظارك` : "محدّث"} />}
        />
        <View style={styles.policy}>
          <IconSymbol name="checkmark.seal.fill" size={22} color="#16835D" />
          <View style={styles.policyText}>
            <Text style={styles.policyTitle}>أنت صاحب القرار</Text>
            <Text style={styles.policyBody}>يمكن لـ Rebel AI أن يقترح ما يتعلمه، لكنه لا يحفظ ولا ينفذ شيئاً دون موافقتك الصريحة.</Text>
          </View>
        </View>
        <SectionTitle title="اقتراحات تحتاج قرارك" detail="تحكم واضح" />
        <FlatList
          data={approvals}
          renderItem={renderApproval}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.empty}><IconSymbol name="checkmark.seal.fill" size={30} color="#16835D" /><Text style={styles.emptyTitle}>لا توجد اقتراحات معلّقة</Text><Text style={styles.emptyText}>ستظهر هنا أي معرفة مقترحة قبل أن تدخل الذاكرة.</Text></View>}
        />
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10 }, policy: { flexDirection: "row-reverse", gap: 11, borderRadius: 17, padding: 14, backgroundColor: "#EAF7F1", borderColor: "#C8E9D9", borderWidth: 1, marginBottom: 20 }, policyText: { flex: 1, gap: 4 }, policyTitle: { color: "#16835D", fontWeight: "800", fontSize: 14, textAlign: "right" }, policyBody: { color: "#446C5B", fontSize: 12, lineHeight: 19, textAlign: "right" }, list: { gap: 11, paddingBottom: 24 }, card: { borderRadius: 17, padding: 15, gap: 9, borderWidth: 1, borderColor: "#E7E7EA", backgroundColor: "#FFFFFF" }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, type: { color: "#777780", fontWeight: "700", fontSize: 11 }, title: { color: "#29292F", fontSize: 16, fontWeight: "800", textAlign: "right" }, detail: { color: "#5F5F68", fontSize: 13, lineHeight: 20, textAlign: "right" }, actions: { flexDirection: "row-reverse", gap: 9, marginTop: 4 }, approve: { flex: 1, paddingVertical: 12, backgroundColor: "#2563EB", borderRadius: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 }, approveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, reject: { minWidth: 86, paddingVertical: 12, backgroundColor: "#F1F1F3", borderRadius: 12, alignItems: "center", justifyContent: "center" }, rejectText: { color: "#55555F", fontSize: 13, fontWeight: "800" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] }, empty: { alignItems: "center", padding: 30, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E7E7EA", gap: 8 }, emptyTitle: { color: "#303037", fontSize: 16, fontWeight: "800" }, emptyText: { color: "#777780", fontSize: 13, lineHeight: 20, textAlign: "center" } });
