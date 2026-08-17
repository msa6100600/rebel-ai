import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { startOwnerSession, useOwnerSession } from "@/lib/owner-session";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { isOwnerSession } = useOwnerSession();
  const [opening, setOpening] = useState(false);
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const ownerLogin = trpc.owner.login.useMutation();

  useEffect(() => {
    if (isAuthenticated || isOwnerSession) router.replace("/(tabs)" as never);
  }, [isAuthenticated, isOwnerSession, router]);

  const handleLogin = async () => {
    setOpening(true);
    haptic.light();
    try {
      await startOAuthLogin();
    } catch {
      setOpening(false);
    }
  };

  const handleOwnerLogin = async () => {
    if (!ownerUsername.trim() || !ownerPassword || ownerLogin.isPending) return;
    setOwnerError("");
    try {
      const result = await ownerLogin.mutateAsync({ username: ownerUsername, password: ownerPassword });
      setOwnerPassword("");
      if (!result.granted) {
        setOwnerError("بيانات حساب المالك غير صحيحة.");
        haptic.warning();
        return;
      }
      await startOwnerSession();
      haptic.success();
      router.replace("/(tabs)" as never);
    } catch {
      setOwnerError("تعذر تسجيل الدخول الآن. أعد المحاولة لاحقاً.");
      haptic.warning();
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6" containerClassName="bg-background" safeAreaClassName="bg-background">
      <View style={styles.page}>
        <View style={styles.mark}><IconSymbol name="brain.head.profile" size={54} color="#44D7FF" /></View>
        <Text style={styles.eyebrow}>YOUR ANALYTICAL COMPANION</Text>
        <Text style={styles.title}>Rebel AI</Text>
        <Text style={styles.subtitle}>أنشئ حساباً أو سجّل الدخول لبدء استخدام المحادثة والتحليل والميزات الصوتية.</Text>
        <View style={styles.featureList}>
          <Feature icon="sparkles" label="تحليل منظّم يوضح درجة اليقين" />
          <Feature icon="checkmark.seal.fill" label="موافقتك مطلوبة قبل حفظ أي تعلّم" />
          <Feature icon="speaker.wave.2.fill" label="محادثة كتابية وصوتية بلغات متعددة" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="إنشاء حساب أو تسجيل الدخول" disabled={opening || loading} onPress={handleLogin} style={({ pressed }) => [styles.loginButton, (opening || loading) && styles.disabled, pressed && styles.pressed]}>
          {opening || loading ? <ActivityIndicator color="#FFFFFF" /> : <><IconSymbol name="person.circle.fill" size={21} color="#FFFFFF" /><Text style={styles.loginText}>إنشاء حساب أو تسجيل الدخول</Text></>}
        </Pressable>
        <View style={styles.ownerDivider}><View style={styles.line} /><Text style={styles.dividerText}>دخول المالك</Text><View style={styles.line} /></View>
        <View style={styles.ownerBox}>
          <TextInput value={ownerUsername} onChangeText={setOwnerUsername} placeholder="اسم مستخدم المالك" placeholderTextColor="#8592B8" autoCapitalize="none" style={styles.ownerInput} accessibilityLabel="اسم مستخدم المالك" />
          <TextInput value={ownerPassword} onChangeText={setOwnerPassword} placeholder="كلمة مرور المالك" placeholderTextColor="#8592B8" secureTextEntry autoCapitalize="none" style={styles.ownerInput} accessibilityLabel="كلمة مرور المالك" onSubmitEditing={handleOwnerLogin} returnKeyType="done" />
          <Pressable accessibilityRole="button" disabled={!ownerUsername.trim() || !ownerPassword || ownerLogin.isPending} onPress={handleOwnerLogin} style={({ pressed }) => [styles.ownerLoginButton, (!ownerUsername.trim() || !ownerPassword || ownerLogin.isPending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.ownerLoginText}>{ownerLogin.isPending ? "جارٍ الدخول…" : "دخول المالك"}</Text></Pressable>
          {ownerError ? <Text style={styles.ownerError}>{ownerError}</Text> : null}
        </View>
        <Text style={styles.footnote}>تتم المصادقة عبر بوابة آمنة، ولا يخزن Rebel AI كلمة مرورك داخل التطبيق.</Text>
      </View>
    </ScreenContainer>
  );
}

function Feature({ icon, label }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string }) {
  return <View style={styles.feature}><IconSymbol name={icon} size={20} color="#8E7BFF" /><Text style={styles.featureText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, maxWidth: 440, alignSelf: "center" },
  mark: { width: 98, height: 98, borderRadius: 30, backgroundColor: "#152445", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#36548B", marginBottom: 8 },
  eyebrow: { color: "#44D7FF", fontWeight: "900", fontSize: 11, letterSpacing: 1.6, textAlign: "center" },
  title: { color: "#F5F7FF", fontSize: 36, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "#B6C1E0", fontSize: 15, lineHeight: 24, textAlign: "center", maxWidth: 330, marginBottom: 8 },
  featureList: { width: "100%", backgroundColor: "#121A31", borderColor: "#293A60", borderWidth: 1, borderRadius: 18, padding: 15, gap: 13 },
  feature: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  featureText: { color: "#D8DFF3", fontSize: 13, flex: 1, textAlign: "right" },
  loginButton: { width: "100%", minHeight: 54, borderRadius: 15, backgroundColor: "#7158EF", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 9, marginTop: 8 },
  loginText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  ownerDivider: { flexDirection: "row-reverse", alignItems: "center", gap: 10, width: "100%", marginTop: 2 }, line: { height: 1, flex: 1, backgroundColor: "#2E3D63" }, dividerText: { color: "#8E9ABD", fontSize: 11, fontWeight: "800" },
  ownerBox: { width: "100%", backgroundColor: "#18233D", borderWidth: 1, borderColor: "#354A7A", borderRadius: 16, padding: 12, gap: 9 }, ownerInput: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: "#354A7A", color: "#F5F7FF", backgroundColor: "#10182C", textAlign: "right", paddingHorizontal: 11, fontSize: 13 }, ownerLoginButton: { minHeight: 43, borderRadius: 10, backgroundColor: "#354F8E", alignItems: "center", justifyContent: "center" }, ownerLoginText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, ownerError: { color: "#FFABB8", fontSize: 11, textAlign: "right" },
  footnote: { color: "#7D8AAF", fontSize: 11, lineHeight: 18, textAlign: "center", maxWidth: 320 },
  disabled: { opacity: 0.6 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
