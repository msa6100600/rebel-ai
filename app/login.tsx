import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { startOwnerSession, useOwnerSession } from "@/lib/owner-session";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const router = useRouter();
  const { isOwnerSession, loading } = useOwnerSession();
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const ownerLogin = trpc.owner.login.useMutation();

  useEffect(() => {
    if (isOwnerSession) router.replace("/(tabs)" as never);
  }, [isOwnerSession, router]);

  const handleOwnerLogin = async () => {
    if (!ownerPassword || ownerLogin.isPending) return;
    setOwnerError("");
    try {
      const result = await ownerLogin.mutateAsync({ username: "Rebel Ai", password: ownerPassword.trim() });
      setOwnerPassword("");
      if (!result.granted) {
        setOwnerError("بيانات حساب Rebel Ai غير صحيحة.");
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
        <View style={styles.mark}><IconSymbol name="brain.head.profile" size={42} color="#2563EB" /></View>
        <Text style={styles.eyebrow}>YOUR THINKING PARTNER</Text>
        <Text style={styles.title}>Rebel AI</Text>
        <Text style={styles.subtitle}>سجّل الدخول إلى حساب Rebel Ai لبدء المحادثة والتحليل والميزات الصوتية.</Text>
        <View style={styles.featureList}>
          <Feature icon="sparkles" label="تحليل منظّم يوضح درجة اليقين" />
          <Feature icon="checkmark.seal.fill" label="موافقتك مطلوبة قبل حفظ أي تعلّم" />
          <Feature icon="speaker.wave.2.fill" label="محادثة كتابية وصوتية بلغات متعددة" />
        </View>
        <View style={styles.ownerDivider}><View style={styles.line} /><Text style={styles.dividerText}>الحساب الوحيد</Text><View style={styles.line} /></View>
        <View style={styles.ownerBox}>
          <View style={styles.usernameValue}><IconSymbol name="person.circle.fill" size={20} color="#2563EB" /><Text style={styles.usernameText}>Rebel Ai</Text></View>
          <TextInput value={ownerPassword} onChangeText={setOwnerPassword} placeholder="كلمة مرور Rebel Ai" placeholderTextColor="#8592B8" secureTextEntry autoCapitalize="none" style={styles.ownerInput} accessibilityLabel="كلمة مرور Rebel Ai" onSubmitEditing={handleOwnerLogin} returnKeyType="done" />
          <Pressable accessibilityRole="button" disabled={!ownerPassword || ownerLogin.isPending || loading} onPress={handleOwnerLogin} style={({ pressed }) => [styles.ownerLoginButton, (!ownerPassword || ownerLogin.isPending || loading) && styles.disabled, pressed && styles.pressed]}><Text style={styles.ownerLoginText}>{ownerLogin.isPending ? "جارٍ الدخول…" : "دخول Rebel Ai"}</Text></Pressable>
          {ownerError ? <Text style={styles.ownerError}>{ownerError}</Text> : null}
        </View>
        <Text style={styles.footnote}>تتم المصادقة عبر بوابة آمنة، ولا يخزن Rebel AI كلمة مرورك داخل التطبيق.</Text>
      </View>
    </ScreenContainer>
  );
}

function Feature({ icon, label }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string }) {
  return <View style={styles.feature}><IconSymbol name={icon} size={19} color="#2563EB" /><Text style={styles.featureText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 13, maxWidth: 440, alignSelf: "center" },
  mark: { width: 74, height: 74, borderRadius: 25, backgroundColor: "#EAF1FF", alignItems: "center", justifyContent: "center", marginBottom: 5 },
  eyebrow: { color: "#73737D", fontWeight: "800", fontSize: 10, letterSpacing: 1.5, textAlign: "center" },
  title: { color: "#1F1F23", fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { color: "#707079", fontSize: 15, lineHeight: 23, textAlign: "center", maxWidth: 330, marginBottom: 7 },
  featureList: { width: "100%", backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 18, padding: 15, gap: 13 },
  feature: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  featureText: { color: "#4D4D56", fontSize: 13, flex: 1, textAlign: "right" },
  loginButton: { width: "100%", minHeight: 54, borderRadius: 15, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 9, marginTop: 8 },
  loginText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  ownerDivider: { flexDirection: "row-reverse", alignItems: "center", gap: 10, width: "100%", marginTop: 2 }, line: { height: 1, flex: 1, backgroundColor: "#E2E2E6" }, dividerText: { color: "#87878F", fontSize: 11, fontWeight: "800" },
  ownerBox: { width: "100%", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 16, padding: 12, gap: 9 }, usernameValue: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: "#DEDEE3", backgroundColor: "#F8FAFF", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 }, usernameText: { color: "#25252B", fontSize: 14, fontWeight: "800" }, ownerInput: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: "#DEDEE3", color: "#25252B", backgroundColor: "#FFFFFF", textAlign: "right", paddingHorizontal: 11, fontSize: 13 }, ownerLoginButton: { minHeight: 43, borderRadius: 10, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" }, ownerLoginText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, ownerError: { color: "#C7374F", fontSize: 11, textAlign: "right" },
  footnote: { color: "#8B8B94", fontSize: 11, lineHeight: 18, textAlign: "center", maxWidth: 320 },
  disabled: { opacity: 0.6 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
