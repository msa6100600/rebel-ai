import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const unlockOwner = trpc.owner.unlock.useMutation();
  if (!isAuthenticated) return <Redirect href="/login" />;

  const signOut = async () => {
    haptic.medium();
    await logout();
    router.replace("/login" as never);
  };

  const verifyOwner = async () => {
    if (!ownerPassword.trim() || unlockOwner.isPending) return;
    setOwnerError("");
    try {
      const result = await unlockOwner.mutateAsync({ password: ownerPassword });
      setOwnerPassword("");
      if (!result.granted) {
        setOwnerError("تعذر فتح وضع المالك. تحقق من كلمة المرور.");
        haptic.warning();
        return;
      }
      setOwnerUnlocked(true);
      haptic.success();
    } catch {
      setOwnerError("تعذر التحقق الآن. أعد المحاولة لاحقاً.");
      haptic.warning();
    }
  };

  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}><ScreenHeading eyebrow="YOUR REBEL AI SESSION" title="حسابي" action={<StatusPill tone="success" label="متصل" />} /><View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || user?.email || "R").slice(0, 1).toLocaleUpperCase()}</Text></View><Text style={styles.name}>{user?.name || "مستخدم Rebel AI"}</Text><Text style={styles.email}>{user?.email || "تم تسجيل الدخول بنجاح"}</Text><View style={styles.infoRow}><Text style={styles.infoValue}>{user?.loginMethod || "بوابة الحساب"}</Text><Text style={styles.infoLabel}>طريقة الدخول</Text></View></View><View style={styles.notice}><IconSymbol name="checkmark.seal.fill" size={20} color="#44D7FF" /><Text style={styles.noticeText}>جلسة حسابك مخزنة بأمان على هذا الجهاز. الذاكرة وسجل المحادثة ما زالا محليين ولا ينتقلان إلى أجهزة أخرى في هذه النسخة.</Text></View><View style={[styles.ownerCard, ownerUnlocked && styles.ownerCardUnlocked]}><View style={styles.ownerHeader}><StatusPill tone={ownerUnlocked ? "success" : "warning"} label={ownerUnlocked ? "مفعل" : "مقفل"} /><Text style={styles.ownerTitle}>وضع المالك</Text></View>{ownerUnlocked ? <><Text style={styles.ownerBody}>تم فتح صلاحيات إدارة الإعدادات وطلبات التغيير المقترحة لهذه الجلسة.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/settings" as never)} style={({ pressed }) => [styles.ownerButton, pressed && styles.pressed]}><Text style={styles.ownerButtonText}>فتح إعدادات المالك</Text></Pressable></> : <><Text style={styles.ownerBody}>أدخل كلمة مرور المالك لفتح أدوات الإدارة في هذه الجلسة فقط.</Text><TextInput value={ownerPassword} onChangeText={setOwnerPassword} placeholder="كلمة مرور المالك" placeholderTextColor="#8B97BB" secureTextEntry autoCapitalize="none" style={styles.ownerInput} accessibilityLabel="كلمة مرور المالك" onSubmitEditing={verifyOwner} returnKeyType="done" /><Pressable accessibilityRole="button" disabled={!ownerPassword.trim() || unlockOwner.isPending} onPress={verifyOwner} style={({ pressed }) => [styles.ownerButton, (!ownerPassword.trim() || unlockOwner.isPending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.ownerButtonText}>{unlockOwner.isPending ? "جارٍ التحقق…" : "فتح وضع المالك"}</Text></Pressable>{ownerError ? <Text style={styles.ownerError}>{ownerError}</Text> : null}</>}</View><Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><IconSymbol name="xmark" size={18} color="#FFDCE4" /><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable></View></ScreenContainer>;
}

const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 10, gap: 16 }, profileCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 20, padding: 24, gap: 7 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#EAF1FF", justifyContent: "center", alignItems: "center", marginBottom: 4 }, avatarText: { color: "#2563EB", fontSize: 30, fontWeight: "900" }, name: { color: "#25252B", fontSize: 19, fontWeight: "900", textAlign: "center" }, email: { color: "#75757E", fontSize: 13, textAlign: "center" }, infoRow: { flexDirection: "row-reverse", justifyContent: "space-between", width: "100%", borderTopColor: "#ECECEF", borderTopWidth: 1, marginTop: 10, paddingTop: 13 }, infoLabel: { color: "#85858E", fontSize: 12 }, infoValue: { color: "#4B4B54", fontSize: 12, fontWeight: "700" }, notice: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#D7E6FF", borderRadius: 16, padding: 14 }, noticeText: { flex: 1, color: "#4F5D79", fontSize: 12, lineHeight: 19, textAlign: "right" }, ownerCard: { backgroundColor: "#FFF8EE", borderWidth: 1, borderColor: "#F0D9B6", borderRadius: 17, padding: 14, gap: 10 }, ownerCardUnlocked: { backgroundColor: "#EAF7F1", borderColor: "#C8E9D9" }, ownerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, ownerTitle: { color: "#2E2E35", fontSize: 15, fontWeight: "900", textAlign: "right" }, ownerBody: { color: "#665B4A", fontSize: 12, lineHeight: 19, textAlign: "right" }, ownerInput: { backgroundColor: "#FFFFFF", borderColor: "#E4D5C0", borderWidth: 1, borderRadius: 11, minHeight: 46, color: "#25252B", textAlign: "right", paddingHorizontal: 11, fontSize: 13 }, ownerButton: { backgroundColor: "#2563EB", borderRadius: 11, paddingVertical: 11, alignItems: "center" }, ownerButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, ownerError: { color: "#C7374F", fontSize: 11, textAlign: "right" }, logout: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: "#FFF4F5", borderWidth: 1, borderColor: "#F1CDD3" }, logoutText: { color: "#B2273E", fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] } });
