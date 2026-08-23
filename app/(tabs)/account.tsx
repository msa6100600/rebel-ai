import { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelSession } from "@/lib/rebel-session";
import { trpc } from "@/lib/trpc";

export default function AccountScreen() {
  const router = useRouter();
  const { session, endSession } = useRebelSession();
  const deleteAccount = trpc.account.deleteAccount.useMutation();
  const exportData = trpc.account.exportData.useMutation();
  const account = session?.account;
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const signOut = async () => { haptic.medium(); await endSession(); router.replace("/login" as never); };
  const downloadData = async () => {
    try {
      const data = await exportData.mutateAsync();
      if (Platform.OS === "web") {
        Alert.alert("التصدير متاح من الهاتف", "لأسباب خصوصية، استخدم تطبيق Android أو iPhone لإنشاء ومشاركة ملف بياناتك محلياً.");
        return;
      }
      const file = new File(Paths.cache, `rebel-ai-data-${Date.now()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "تصدير بيانات Rebel AI" });
      haptic.success();
    } catch {
      Alert.alert("تعذر تصدير البيانات", "تعذر إنشاء ملف بياناتك الآن. تحقق من الاتصال أو مساحة الجهاز ثم أعد المحاولة.");
      haptic.warning();
    }
  };
  const confirmDelete = async () => {
    if (deleteConfirmation !== "DELETE" || !deletePassword) { Alert.alert("تأكيد ناقص", "اكتب DELETE بالإنجليزية ثم أدخل كلمة مرورك لإتمام الحذف."); return; }
    try {
      await deleteAccount.mutateAsync({ password: deletePassword, confirmation: "DELETE" });
      await endSession();
      haptic.success();
      Alert.alert("تم حذف الحساب", "حُذفت المحادثات والذاكرة والمفاتيح والبيانات المرتبطة بالحساب.");
      router.replace("/login" as never);
    } catch (error) {
      Alert.alert("تعذر الحذف", error instanceof Error ? error.message : "تحقق من كلمة المرور ثم أعد المحاولة.");
      haptic.warning();
    }
  };
  const isOwner = account?.role === "owner";
  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}><ScreenHeading eyebrow="REBEL AI ACCOUNT" title="حسابي" action={<StatusPill tone="success" label="متصل" />} /><View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{account?.displayName.slice(0, 1).toUpperCase() ?? "R"}</Text></View><Text style={styles.name}>{account?.displayName ?? "حساب Rebel AI"}</Text><Text style={styles.caption}>@{account?.username}</Text><View style={styles.infoRow}><Text style={styles.infoValue}>{isOwner ? "مالك التطبيق" : "مستخدم Rebel AI"}</Text><Text style={styles.infoLabel}>نوع الحساب</Text></View></View><View style={styles.notice}><IconSymbol name="checkmark.seal.fill" size={20} color="#2563EB" /><Text style={styles.noticeText}>يرتبط سجل محادثاتك وذاكرتك السحابية بحسابك فقط، ولا يراهما أي حساب آخر.</Text></View>{isOwner ? <Pressable accessibilityRole="button" onPress={() => router.push("/analytics" as never)} style={({ pressed }) => [styles.analytics, pressed && styles.pressed]}><IconSymbol name="chart.bar.xaxis" size={20} color="#16835D" /><Text style={styles.analyticsText}>تحليلات استخدام Rebel AI</Text></Pressable> : null}<Pressable accessibilityRole="button" onPress={downloadData} disabled={exportData.isPending} style={({ pressed }) => [styles.exportData, exportData.isPending && styles.disabled, pressed && styles.pressed]}><IconSymbol name="arrow.down.doc" size={20} color="#276653" /><View style={styles.exportCopy}><Text style={styles.exportTitle}>{exportData.isPending ? "جارٍ تجهيز بياناتك…" : "تصدير بياناتي"}</Text><Text style={styles.exportDetail}>ملف JSON للمحادثات والذكريات والمشاريع؛ لا يشمل كلمة المرور أو قيم مفاتيح API.</Text></View></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/settings" as never)} style={({ pressed }) => [styles.settings, pressed && styles.pressed]}><IconSymbol name="gearshape.fill" size={20} color="#2563EB" /><Text style={styles.settingsText}>الإعدادات والحصة والمفاتيح الشخصية</Text></Pressable>{showDeleteForm ? <View style={styles.deletePanel}><Text style={styles.deleteTitle}>حذف الحساب نهائياً</Text><Text style={styles.deleteHint}>سيُحذف سجل المحادثات والذاكرة السحابية والمفاتيح والحصة، ولا يمكن استعادتها.</Text><TextInput value={deletePassword} onChangeText={setDeletePassword} secureTextEntry placeholder="كلمة المرور" placeholderTextColor="#9C7A80" style={styles.deleteInput} accessibilityLabel="كلمة مرور تأكيد حذف الحساب" /><TextInput value={deleteConfirmation} onChangeText={setDeleteConfirmation} autoCapitalize="characters" placeholder="اكتب DELETE للتأكيد" placeholderTextColor="#9C7A80" style={styles.deleteInput} accessibilityLabel="تأكيد حذف الحساب" /><Pressable accessibilityRole="button" onPress={confirmDelete} disabled={deleteAccount.isPending} style={({ pressed }) => [styles.confirmDelete, deleteAccount.isPending && styles.disabled, pressed && styles.pressed]}><Text style={styles.confirmDeleteText}>{deleteAccount.isPending ? "جارٍ الحذف…" : "حذف حسابي وبياناتي"}</Text></Pressable><Pressable onPress={() => { setShowDeleteForm(false); setDeletePassword(""); setDeleteConfirmation(""); }} style={styles.cancelDelete}><Text style={styles.cancelDeleteText}>إلغاء</Text></Pressable></View> : <Pressable accessibilityRole="button" onPress={() => setShowDeleteForm(true)} style={({ pressed }) => [styles.deleteAccount, pressed && styles.pressed]}><IconSymbol name="trash.fill" size={18} color="#B2273E" /><Text style={styles.deleteAccountText}>حذف الحساب وكل البيانات</Text></Pressable>}<Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><IconSymbol name="xmark" size={18} color="#B2273E" /><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable></View></ScreenContainer>;
}

const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10, gap: 16 }, profileCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 20, padding: 24, gap: 7 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#EAF1FF", justifyContent: "center", alignItems: "center", marginBottom: 4 }, avatarText: { color: "#2563EB", fontSize: 30, fontWeight: "900" }, name: { color: "#25252B", fontSize: 20, fontWeight: "900", textAlign: "center" }, caption: { color: "#75757E", fontSize: 13, textAlign: "center" }, infoRow: { flexDirection: "row-reverse", justifyContent: "space-between", width: "100%", borderTopColor: "#ECECEF", borderTopWidth: 1, marginTop: 10, paddingTop: 13 }, infoLabel: { color: "#85858E", fontSize: 12 }, infoValue: { color: "#4B4B54", fontSize: 12, fontWeight: "700" }, notice: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#D7E6FF", borderRadius: 16, padding: 14 }, noticeText: { flex: 1, color: "#4F5D79", fontSize: 12, lineHeight: 19, textAlign: "right" }, analytics: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#EFFAF4", borderWidth: 1, borderColor: "#CBE8D7", paddingVertical: 13, borderRadius: 14 }, analyticsText: { color: "#16835D", fontSize: 14, fontWeight: "900" }, exportData: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#EFFAF4", borderWidth: 1, borderColor: "#CBE8D7", padding: 13, borderRadius: 14 }, exportCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, exportTitle: { color: "#276653", fontSize: 14, fontWeight: "900", textAlign: "right" }, exportDetail: { color: "#5C7A6E", fontSize: 10, lineHeight: 16, textAlign: "right" }, settings: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E6FF", paddingVertical: 13, borderRadius: 14 }, settingsText: { color: "#2563EB", fontSize: 14, fontWeight: "900" }, deleteAccount: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: "#FFF9F9", borderWidth: 1, borderColor: "#F2D5D9" }, deleteAccountText: { color: "#B2273E", fontSize: 14, fontWeight: "900" }, deletePanel: { backgroundColor: "#FFF7F7", borderWidth: 1, borderColor: "#F1CDD3", borderRadius: 16, padding: 14, gap: 10 }, deleteTitle: { color: "#A61F35", fontWeight: "900", fontSize: 16, textAlign: "right" }, deleteHint: { color: "#7D5158", fontSize: 12, lineHeight: 18, textAlign: "right" }, deleteInput: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBCFD4", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: "#30252A", textAlign: "right" }, confirmDelete: { alignItems: "center", backgroundColor: "#B2273E", borderRadius: 11, paddingVertical: 12 }, confirmDeleteText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 }, cancelDelete: { alignItems: "center", paddingVertical: 8 }, cancelDeleteText: { color: "#775A5F", fontWeight: "800", fontSize: 13 }, logout: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: "#FFF4F5", borderWidth: 1, borderColor: "#F1CDD3" }, logoutText: { color: "#B2273E", fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.48 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
