import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeading, SectionTitle, StatusPill } from "@/components/rebel-ui";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { useRebelSession } from "@/lib/rebel-session";
import { voiceProfiles, useRebelStore, type VoiceProfile } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

export default function SettingsScreen() {
  const router = useRouter();
  const { preferences, updatePreferences, clearMemories, clearMessages, ownerRequests, addOwnerRequest } = useRebelStore();
  const { session } = useRebelSession();
  const usage = trpc.account.usage.useQuery({ provider: preferences.selectedProvider });
  const [ownerRequest, setOwnerRequest] = useState("");
  const [checkingVoices, setCheckingVoices] = useState(true);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const selected = voiceProfiles.find((voice) => voice.id === preferences.selectedVoiceId) ?? voiceProfiles[0];

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => setAvailableLanguages(voices.map((voice) => voice.language.toLowerCase())))
      .catch(() => setAvailableLanguages([]))
      .finally(() => setCheckingVoices(false));
  }, []);

  const availableVoiceIds = useMemo(() => new Set(voiceProfiles.filter((voice) => {
    const baseLanguage = voice.language.split("-")[0].toLowerCase();
    return availableLanguages.some((language) => language === voice.language.toLowerCase() || language.startsWith(`${baseLanguage}-`));
  }).map((voice) => voice.id)), [availableLanguages]);
  const selectedAvailable = availableVoiceIds.has(selected.id);

  const selectVoice = (voice: VoiceProfile) => {
    if (!availableVoiceIds.has(voice.id)) {
      Alert.alert("الصوت غير متاح", "هذا الملف يحتاج صوتاً أو حزمة لغة متوافقة في جهازك. ثبّت اللغة من إعدادات Android أو اختر صوتاً متاحاً.");
      return;
    }
    updatePreferences({ selectedVoiceId: voice.id, preferredLanguage: voice.language });
    haptic.light();
  };

  const previewVoice = async () => {
    if (!selectedAvailable) {
      Alert.alert("الصوت غير متاح", "ثبّت حزمة اللغة من إعدادات Android أو اختر صوتاً متاحاً.");
      return;
    }
    const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
    const nativeVoice = voices.find((voice) => voice.language.toLowerCase() === selected.language.toLowerCase()) ?? voices.find((voice) => voice.language.toLowerCase().startsWith(selected.language.split("-")[0].toLowerCase()));
    Speech.stop();
    Speech.speak(`مرحباً، أنا ${selected.name}. هذا اختبار للصوت المختار في Rebal Live.`, { language: selected.language, voice: nativeVoice?.identifier, rate: selected.rate, pitch: selected.pitch });
  };

  const submitOwnerRequest = () => {
    if (!ownerRequest.trim()) return;
    addOwnerRequest(ownerRequest.trim());
    setOwnerRequest("");
    haptic.success();
  };
  const confirmClear = (kind: "memory" | "messages") => Alert.alert(kind === "memory" ? "حذف الذاكرة؟" : "حذف سجل المحادثة؟", kind === "memory" ? "سيتم حذف عناصر الذاكرة المخزنة على هذا الجهاز فقط." : "سيتم حذف كل الرسائل المخزنة على هذا الجهاز فقط.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => { if (kind === "memory") clearMemories(); else clearMessages(); haptic.medium(); } }]);
  const renderVoice = ({ item }: { item: VoiceProfile }) => {
    const active = selected.id === item.id;
    const available = availableVoiceIds.has(item.id);
    const status = checkingVoices ? "جارٍ فحص الجهاز" : available ? "متاح على جهازك" : "يتطلب صوت اللغة في الجهاز";
    return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active, disabled: !checkingVoices && !available }} disabled={!checkingVoices && !available} onPress={() => selectVoice(item)} style={({ pressed }) => [styles.voiceCard, active && styles.voiceCardActive, !checkingVoices && !available && styles.voiceCardUnavailable, pressed && styles.pressed]}><View style={styles.voiceLeft}>{active ? <IconSymbol name="checkmark.seal.fill" color="#8E7BFF" size={21} /> : <View style={styles.radio} />}</View><View style={styles.voiceText}><Text style={styles.voiceName}>{item.name}</Text><Text style={styles.voiceMeta}>{item.gender} · {item.dialect}</Text><Text style={[styles.voiceStatus, available ? styles.available : styles.unavailable]}>{status}</Text></View></Pressable>;
  };

  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <ScreenHeading eyebrow="CONTROL & PRIVACY" title="الإعدادات" action={<StatusPill tone={selectedAvailable ? "success" : "warning"} label={checkingVoices ? "فحص الصوت" : `${availableVoiceIds.size}/10 متاح`} />} />
    <View style={styles.privacy}><IconSymbol name="checkmark.seal.fill" size={21} color="#44D7FF" /><Text style={styles.privacyText}>تُحفظ المحادثات والذاكرة محلياً على جهازك في هذه النسخة. يمكنك حذفها في أي وقت.</Text></View>
    <View style={styles.quotaCard}><View><Text style={styles.quotaValue}>{usage.data ? `${usage.data.remaining}/${usage.data.limit}` : "…"}</Text><Text style={styles.quotaCaption}>رسالة متبقية اليوم</Text></View><View style={styles.quotaText}><Text style={styles.quotaTitle}>حصتك المجانية</Text><Text style={styles.quotaDetail}>الحصة منفصلة لكل حساب وتتجدد يومياً.</Text></View></View>
    <Pressable accessibilityRole="button" onPress={() => router.push("/keys" as never)} style={({ pressed }) => [styles.providerLink, pressed && styles.pressed]}><IconSymbol name="key.fill" size={21} color="#2563EB" /><View style={styles.providerText}><Text style={styles.providerTitle}>استخدم مفتاحك الخاص</Text><Text style={styles.providerDetail}>اختياري. أضف مفتاحاً لموفّر واحد بعد اختباره، أو احذفه فوراً.</Text></View><IconSymbol name="chevron.right" size={20} color="#7C7C85" /></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push("/providers" as never)} style={({ pressed }) => [styles.providerLink, pressed && styles.pressed]}><IconSymbol name="sparkles" size={21} color="#6DE5FF" /><View style={styles.providerText}><Text style={styles.providerTitle}>خدمات الذكاء الاصطناعي</Text><Text style={styles.providerDetail}>اختر نموذج Rebel Core أو راجع الموفّرات المتاحة للربط.</Text></View><IconSymbol name="chevron.right" size={20} color="#AEBBE0" /></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push("/plugins" as never)} style={({ pressed }) => [styles.providerLink, pressed && styles.pressed]}><IconSymbol name="puzzlepiece.extension.fill" size={21} color="#2563EB" /><View style={styles.providerText}><Text style={styles.providerTitle}>المكونات الإضافية</Text><Text style={styles.providerDetail}>اربط Google Drive أو GitHub أو Notion عندما يكون التفويض جاهزاً.</Text></View><IconSymbol name="chevron.right" size={20} color="#7C7C85" /></Pressable>
    <SectionTitle title="الصوت واللهجة" detail="10 ملفات صوتية" />
    <FlatList data={voiceProfiles} renderItem={renderVoice} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={styles.voiceRow} contentContainerStyle={styles.voiceList} scrollEnabled={false} />
    <Pressable accessibilityRole="button" onPress={previewVoice} disabled={checkingVoices || !selectedAvailable} style={({ pressed }) => [styles.previewButton, (checkingVoices || !selectedAvailable) && styles.disabled, pressed && styles.pressed]}><IconSymbol name="speaker.wave.2.fill" size={18} color="#FFFFFF" /><Text style={styles.previewText}>معاينة الصوت المختار</Text></Pressable>
    <Text style={styles.deviceNote}>لا يمكن ضمان توفر كل أصوات اللغات العشرة في كل هاتف؛ التطبيق يعرض فوراً ما يدعمه جهازك ويمنع اختيار غير المتاح. يمكن تثبيت لغات أو أصوات إضافية من إعدادات النص إلى كلام في Android.</Text>
    <SectionTitle title="سلوك المساعد" />
    <View style={styles.settingCard}><SettingToggle value={preferences.allowSuggestedLearning} onChange={(value) => { updatePreferences({ allowSuggestedLearning: value }); haptic.medium(); }} title="اقتراح تعلّم جديد" detail="اعرض اقتراحات الحفظ للموافقة فقط." /><View style={styles.divider} /><SettingToggle value={preferences.hapticsEnabled} onChange={(value) => updatePreferences({ hapticsEnabled: value })} title="استجابة لمسية" detail="تنبيه لطيف عند الإجراءات المهمة في الهاتف." /></View>
    {session?.account.role === "owner" ? <><SectionTitle title="وضع المالك" detail="إدارة محلية" /><View style={styles.ownerCard}><View style={styles.ownerHeader}><StatusPill tone="success" label="مالك الجلسة" /><Text style={styles.ownerTitle}>طلبات تغيير منظمة</Text></View><Text style={styles.ownerDetail}>دوّن ما تريد تعديله في التطبيق أو إعداداته. يحتفظ Rebel AI بالطلب كمقترح واضح للمراجعة ولا يغيّر التطبيق ذاتياً.</Text><TextInput value={ownerRequest} onChangeText={setOwnerRequest} accessibilityLabel="طلب تغيير من المالك" placeholder="مثال: أضف تصنيفاً جديداً للذاكرة" placeholderTextColor="#7D8BB1" multiline style={styles.ownerInput} /><Pressable accessibilityRole="button" onPress={submitOwnerRequest} disabled={!ownerRequest.trim()} style={({ pressed }) => [styles.ownerButton, !ownerRequest.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.ownerButtonText}>حفظ طلب التغيير</Text></Pressable>{ownerRequests[0] ? <Text style={styles.ownerRecent}>آخر طلب: {ownerRequests[0].request} · {ownerRequests[0].status}</Text> : null}</View></> : null}
    <SectionTitle title="البيانات المحلية" />
    <View style={styles.dangerCard}><Text style={styles.dangerText}>لن يؤثر الحذف إلا في هذا الجهاز، ولا يمكن التراجع عنه.</Text><View style={styles.dangerActions}><Pressable accessibilityRole="button" onPress={() => confirmClear("messages")} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}><Text style={styles.dangerButtonText}>حذف السجل</Text></Pressable><Pressable accessibilityRole="button" onPress={() => confirmClear("memory")} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}><Text style={styles.dangerButtonText}>حذف الذاكرة</Text></Pressable></View></View>
  </View></ScreenContainer>;
}

function SettingToggle({ value, onChange, title, detail }: { value: boolean; onChange: (value: boolean) => void; title: string; detail: string }) {
  return <View style={styles.settingLine}><Switch value={value} onValueChange={onChange} trackColor={{ false: "#D5D5DA", true: "#93B8FF" }} thumbColor="#FFFFFF" /><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 10, paddingBottom: 28 }, privacy: { flexDirection: "row-reverse", gap: 9, backgroundColor: "#EEF4FF", borderWidth: 1, borderColor: "#D7E6FF", borderRadius: 16, padding: 13, marginBottom: 14 }, privacyText: { color: "#4E5C78", fontSize: 12, lineHeight: 19, textAlign: "right", flex: 1 }, quotaCard: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderRadius: 16, padding: 14, backgroundColor: "#F4F8FF", borderWidth: 1, borderColor: "#D7E6FF", marginBottom: 10 }, quotaText: { alignItems: "flex-end", gap: 3, flex: 1 }, quotaTitle: { color: "#25324D", fontSize: 14, fontWeight: "900" }, quotaDetail: { color: "#65718A", fontSize: 11 }, quotaValue: { color: "#2563EB", fontSize: 21, fontWeight: "900", textAlign: "left" }, quotaCaption: { color: "#65718A", fontSize: 10 }, providerLink: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 20 }, providerText: { flex: 1, alignItems: "flex-end", gap: 3 }, providerTitle: { color: "#2A2A30", fontSize: 14, fontWeight: "900", textAlign: "right" }, providerDetail: { color: "#7C7C85", fontSize: 11, textAlign: "right" }, voiceList: { gap: 9, marginBottom: 9 }, voiceRow: { gap: 9 }, voiceCard: { flex: 1, minHeight: 98, backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }, voiceCardActive: { borderColor: "#93B8FF", backgroundColor: "#F4F7FF" }, voiceCardUnavailable: { opacity: 0.48, borderColor: "#D2D2D7" }, voiceLeft: { width: 22, alignItems: "center" }, radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#9A9AA3" }, voiceText: { flex: 1, alignItems: "flex-end", gap: 3 }, voiceName: { color: "#2A2A30", fontWeight: "900", fontSize: 15, textAlign: "right" }, voiceMeta: { color: "#7A7A83", fontWeight: "600", fontSize: 10, textAlign: "right" }, voiceStatus: { fontSize: 9, fontWeight: "800", textAlign: "right" }, available: { color: "#16835D" }, unavailable: { color: "#B45309" }, previewButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 11, marginBottom: 9 }, previewText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, deviceNote: { color: "#7D7D86", fontSize: 11, lineHeight: 17, textAlign: "right", marginBottom: 20 }, settingCard: { backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 }, settingLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, settingText: { alignItems: "flex-end", flex: 1, gap: 3 }, settingTitle: { color: "#29292F", fontSize: 14, fontWeight: "900", textAlign: "right" }, settingDetail: { color: "#808089", fontSize: 11, textAlign: "right" }, divider: { height: 1, backgroundColor: "#ECECEF", marginVertical: 13 }, ownerCard: { backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, marginBottom: 20 }, ownerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, ownerTitle: { color: "#29292F", fontSize: 14, fontWeight: "900", textAlign: "right" }, ownerDetail: { color: "#60606A", fontSize: 12, lineHeight: 19, textAlign: "right" }, ownerInput: { color: "#29292F", backgroundColor: "#FAFAFB", borderWidth: 1, borderColor: "#E3E3E7", borderRadius: 11, minHeight: 56, padding: 10, fontSize: 12, lineHeight: 18, textAlign: "right" }, ownerButton: { borderRadius: 11, paddingVertical: 11, backgroundColor: "#2563EB", alignItems: "center" }, ownerButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, ownerRecent: { color: "#777780", fontSize: 11, lineHeight: 17, textAlign: "right" }, dangerCard: { backgroundColor: "#FFF7F8", borderColor: "#F0D0D5", borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }, dangerText: { color: "#8E4856", fontSize: 12, lineHeight: 18, textAlign: "right" }, dangerActions: { flexDirection: "row-reverse", gap: 9 }, dangerButton: { flex: 1, borderRadius: 11, paddingVertical: 11, backgroundColor: "#FFECEF", alignItems: "center" }, dangerButtonText: { color: "#B2273E", fontSize: 12, fontWeight: "900" }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }
});
