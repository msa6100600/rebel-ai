import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelSession } from "@/lib/rebel-session";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const router = useRouter();
  const { session, loading, startSession } = useRebelSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.account.login.useMutation();
  const register = trpc.account.register.useMutation();
  const pending = login.isPending || register.isPending;

  useEffect(() => { if (session) router.replace("/(tabs)" as never); }, [router, session]);

  const submit = async () => {
    if (!username.trim() || !password || (mode === "register" && (!displayName.trim() || !email.trim())) || pending) return;
    setError("");
    try {
      const result = mode === "login"
        ? await login.mutateAsync({ identity: username.trim(), password })
        : await register.mutateAsync({ username: username.trim(), displayName: displayName.trim(), email: email.trim(), password });
      await startSession(result);
      setPassword("");
      haptic.success();
      router.replace("/(tabs)" as never);
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "تعذر إتمام العملية الآن.";
      setError(message.includes("اسم المستخدم") || message.includes("كلمة المرور") || message.includes("محجوز") ? message : "تعذر إتمام العملية الآن. تأكد من اتصالك ثم أعد المحاولة.");
      haptic.warning();
    }
  };

  const changeMode = (next: "login" | "register") => { setMode(next); setError(""); setPassword(""); };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <View style={styles.mark}><IconSymbol name="brain.head.profile" size={42} color="#2563EB" /></View>
    <Text style={styles.eyebrow}>YOUR THINKING PARTNER</Text><Text style={styles.title}>Rebel AI</Text>
    <Text style={styles.subtitle}>{mode === "login" ? "سجّل دخولك بالبريد الإلكتروني أو اسم المستخدم لاستعادة محادثاتك وإعداداتك." : "أنشئ حساباً مستقلاً ببريد إلكتروني لتكون استعادة الحساب ممكنة في الإصدارات القادمة."}</Text>
    <View style={styles.switcher}><Pressable accessibilityRole="button" onPress={() => changeMode("register")} style={({ pressed }) => [styles.modeButton, mode === "register" && styles.modeButtonActive, pressed && styles.pressed]}><Text style={[styles.modeText, mode === "register" && styles.modeTextActive]}>حساب جديد</Text></Pressable><Pressable accessibilityRole="button" onPress={() => changeMode("login")} style={({ pressed }) => [styles.modeButton, mode === "login" && styles.modeButtonActive, pressed && styles.pressed]}><Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>تسجيل الدخول</Text></Pressable></View>
    <View style={styles.form}>
      {mode === "register" ? <><TextInput value={displayName} onChangeText={setDisplayName} placeholder="الاسم الذي سيظهر في حسابك" placeholderTextColor="#8592B8" style={styles.input} accessibilityLabel="اسم العرض" textAlign="right" returnKeyType="next" /><TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor="#8592B8" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input} accessibilityLabel="البريد الإلكتروني" textAlign="left" returnKeyType="next" /></> : null}
      <TextInput value={username} onChangeText={setUsername} placeholder={mode === "login" ? "البريد الإلكتروني أو اسم المستخدم" : "اسم المستخدم بالإنجليزية، مثال: ahmed_ali"} placeholderTextColor="#8592B8" autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel={mode === "login" ? "البريد الإلكتروني أو اسم المستخدم" : "اسم المستخدم"} textAlign={mode === "login" ? "left" : "right"} returnKeyType="next" />
      <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور، 8 أحرف على الأقل" placeholderTextColor="#8592B8" secureTextEntry autoCapitalize="none" style={styles.input} accessibilityLabel="كلمة المرور" textAlign="right" onSubmitEditing={submit} returnKeyType="done" />
      <Pressable accessibilityRole="button" disabled={!username.trim() || !password || (mode === "register" && (!displayName.trim() || !email.trim())) || pending || loading} onPress={submit} style={({ pressed }) => [styles.submit, (!username.trim() || !password || (mode === "register" && (!displayName.trim() || !email.trim())) || pending || loading) && styles.disabled, pressed && styles.pressed]}><Text style={styles.submitText}>{pending ? "جارٍ المتابعة…" : mode === "login" ? "دخول إلى Rebel AI" : "إنشاء الحساب"}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
    <View style={styles.featureList}><Feature icon="checkmark.seal.fill" label="ذاكرتك ومحادثاتك منفصلة عن أي مستخدم آخر" /><Feature icon="sparkles" label="ثلاثة نماذج مجانية مع تحويل تلقائي هادئ" /><Feature icon="speaker.wave.2.fill" label="محادثة كتابية وصوتية بلغات متعددة" /></View>
    <Text style={styles.footnote}>لا نخزن كلمة المرور كنص عادي. يمكنك تسجيل الخروج في أي وقت من صفحة حسابك.</Text>
  </View></ScreenContainer>;
}

function Feature({ icon, label }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string }) { return <View style={styles.feature}><IconSymbol name={icon} size={18} color="#2563EB" /><Text style={styles.featureText}>{label}</Text></View>; }

const styles = StyleSheet.create({ page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, maxWidth: 440, alignSelf: "center" }, mark: { width: 72, height: 72, borderRadius: 25, backgroundColor: "#EAF1FF", alignItems: "center", justifyContent: "center", marginBottom: 2 }, eyebrow: { color: "#73737D", fontWeight: "800", fontSize: 10, letterSpacing: 1.5, textAlign: "center" }, title: { color: "#1F1F23", fontSize: 34, fontWeight: "800", letterSpacing: -0.8 }, subtitle: { color: "#707079", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 340 }, switcher: { width: "100%", flexDirection: "row-reverse", backgroundColor: "#F1F2F6", borderRadius: 12, padding: 4, gap: 4 }, modeButton: { flex: 1, alignItems: "center", borderRadius: 9, paddingVertical: 9 }, modeButtonActive: { backgroundColor: "#FFFFFF", shadowColor: "#1E293B", shadowOpacity: 0.08, shadowRadius: 5, elevation: 1 }, modeText: { color: "#787881", fontSize: 12, fontWeight: "800" }, modeTextActive: { color: "#2563EB" }, form: { width: "100%", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 16, padding: 12, gap: 9 }, input: { minHeight: 45, borderRadius: 10, borderWidth: 1, borderColor: "#DEDEE3", color: "#25252B", backgroundColor: "#FFFFFF", paddingHorizontal: 12, fontSize: 13 }, submit: { minHeight: 45, borderRadius: 10, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", marginTop: 2 }, submitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, error: { color: "#C7374F", fontSize: 11, lineHeight: 16, textAlign: "right" }, featureList: { width: "100%", backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 16, padding: 13, gap: 10 }, feature: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, featureText: { color: "#4D4D56", fontSize: 12, flex: 1, textAlign: "right" }, footnote: { color: "#8B8B94", fontSize: 10, lineHeight: 16, textAlign: "center", maxWidth: 320 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] } });
