import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { voiceProfiles, useRebelStore, type ChatMessage } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

const getMimeType = () => Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

export default function ChatScreen() {
  const router = useRouter();
  const { messages, memories, addMessage, addApproval, preferences } = useRebelStore();
  const [draft, setDraft] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const chat = trpc.assistant.chat.useMutation();
  const transcription = trpc.voice.transcribe.useMutation();
  const selectedVoice = useMemo(() => voiceProfiles.find((voice) => voice.id === preferences.selectedVoiceId) ?? voiceProfiles[0], [preferences.selectedVoiceId]);

  const speak = useCallback(async (text: string) => {
    const available = await Speech.getAvailableVoicesAsync().catch(() => []);
    const nativeVoice = available.find((voice) => voice.language.toLowerCase() === selectedVoice.language.toLowerCase()) ?? available.find((voice) => voice.language.toLowerCase().startsWith(selectedVoice.language.split("-")[0].toLowerCase()));
    if (await Speech.isSpeakingAsync().catch(() => false)) { await Speech.stop(); return; }
    Speech.speak(text, { language: selectedVoice.language, voice: nativeVoice?.identifier, rate: selectedVoice.rate, pitch: selectedVoice.pitch, onError: () => Alert.alert("تعذر تشغيل الصوت", "تأكد من توفر لغة الصوت المختارة في جهازك.") });
  }, [selectedVoice]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || chat.isPending) return;
    haptic.light();
    setDraft("");
    setVoiceNote("");
    addMessage({ role: "user", text });
    try {
      const result = await chat.mutateAsync({ message: text, memories: memories.slice(0, 8).map(({ title, content, category }) => ({ title, content, category })), language: selectedVoice.language, model: preferences.selectedModel as "gpt-5" | "gpt-5-mini" | "claude-sonnet-4-6" | "gemini-3.1-pro-preview" });
      addMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence });
      if (result.suggestedMemory && preferences.allowSuggestedLearning) addApproval({ title: `حفظ معرفة مقترحة: ${result.suggestedMemory.title}`, detail: result.suggestedMemory.content, type: "تعلم مقترح", memory: result.suggestedMemory });
      haptic.success();
    } catch {
      addMessage({ role: "assistant", text: "تعذر إتمام التحليل الآن. لم يتم حفظ أي معلومة. أعد المحاولة بعد التحقق من الاتصال.", isError: true });
      haptic.warning();
    }
  }, [addApproval, addMessage, chat, draft, memories, preferences.allowSuggestedLearning, preferences.selectedModel, selectedVoice.language]);

  const toggleRecording = useCallback(async () => {
    if (Platform.OS === "web") { setVoiceNote("التسجيل الصوتي يُختبر من تطبيق Android المثبت. يمكنك المتابعة بالكتابة هنا."); return; }
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        const audioUri = recorder.uri;
        if (!audioUri) throw new Error("missing audio");
        setVoiceNote("أحوّل كلامك إلى نص…");
        const result = await transcription.mutateAsync({ audioBase64: await new File(audioUri).base64(), mimeType: getMimeType(), language: selectedVoice.language });
        if (!result.ok || !result.text) throw new Error("no transcription");
        setDraft(result.text);
        setVoiceNote("تمت كتابة رسالتك. راجعها ثم أرسلها.");
        haptic.success();
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) { setVoiceNote("يلزم السماح بالميكروفون لاستخدام الصوت."); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceNote("أستمع إليك… اضغط الميكروفون عند الانتهاء.");
      haptic.medium();
    } catch { setVoiceNote("تعذر تسجيل الصوت أو تحويله. أرسل رسالتك كتابةً."); haptic.warning(); }
  }, [recorder, recorderState.isRecording, selectedVoice.language, transcription]);

  const renderMessage = ({ item }: { item: ChatMessage }) => <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}><View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, item.isError && styles.errorMessage]}><View style={styles.messageTop}><Text style={[styles.role, item.role === "user" && styles.userRole]}>{item.role === "user" ? "أنت" : "Rebel AI"}</Text>{item.role === "assistant" ? <Pressable accessibilityRole="button" accessibilityLabel="قراءة الرد بصوت" onPress={() => speak(item.text)} style={({ pressed }) => [styles.soundButton, pressed && styles.pressed]}><IconSymbol name="speaker.wave.2.fill" size={18} color="#5B5B66" /></Pressable> : null}</View><Text style={[styles.messageText, item.role === "user" && styles.userMessageText]}>{item.text}</Text>{item.insight ? <View style={styles.insight}><Text style={styles.insightLabel}>ملاحظة تحليلية</Text><Text style={styles.insightText}>{item.insight}</Text></View> : null}{typeof item.confidence === "number" ? <Text style={styles.confidence}>درجة اليقين {item.confidence}%</Text> : null}</View></View>;

  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <View style={styles.header}><View><Text style={styles.title}>Rebel AI</Text><Text style={styles.subtitle}>فكّر بوضوح. قرّر بهدوء.</Text></View><View style={styles.headerActions}><Pressable accessibilityRole="button" accessibilityLabel="فتح Rebal Live" onPress={() => router.push("/call" as never)} style={({ pressed }) => [styles.liveButton, pressed && styles.pressed]}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="فتح الموافقات" onPress={() => router.push("/approvals" as never)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><IconSymbol name="checkmark.seal.fill" size={21} color="#4D4D57" /></Pressable></View></View>
    <View style={styles.memoryBar}><IconSymbol name="brain.head.profile" size={18} color="#2563EB" /><Text style={styles.memoryText}>{memories.length ? `لديك ${memories.length} عناصر ذاكرة جاهزة لهذا السياق` : "ذاكرتك تبدأ من هنا — لا يتم حفظ شيء دون موافقتك"}</Text></View>
    <View style={styles.messageArea}><FlatList data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false} ListFooterComponent={chat.isPending ? <View style={styles.thinking}><ActivityIndicator color="#2563EB" size="small" /><Text style={styles.thinkingText}>أرتّب السياق والأدلة…</Text></View> : null} /></View>
    {voiceNote ? <Text style={styles.voiceNote}>{voiceNote}</Text> : null}
    <View style={styles.composer}><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"} onPress={toggleRecording} disabled={transcription.isPending || chat.isPending} style={({ pressed }) => [styles.composerIcon, recorderState.isRecording && styles.recording, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={21} color={recorderState.isRecording ? "#FFFFFF" : "#5B5B66"} /></Pressable><TextInput accessibilityLabel="اكتب رسالتك إلى Rebel AI" value={draft} onChangeText={setDraft} onSubmitEditing={() => sendMessage()} placeholder="اسأل Rebel AI أي شيء…" placeholderTextColor="#8B8B95" multiline returnKeyType="send" style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="إرسال" onPress={() => sendMessage()} disabled={!draft.trim() || chat.isPending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || chat.isPending) && styles.sendDisabled, pressed && styles.pressed]}><IconSymbol name="arrow.up.circle.fill" size={28} color="#FFFFFF" /></Pressable></View>
    <Text style={styles.disclaimer}>قد يخطئ Rebel AI. راجع المعلومات المهمة قبل اتخاذ قرار.</Text>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 14 }, header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, marginBottom: 18 }, title: { color: "#1F1F23", fontSize: 25, fontWeight: "800", letterSpacing: -0.5, textAlign: "right" }, subtitle: { color: "#777780", fontSize: 12, marginTop: 3, textAlign: "right" }, headerActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, liveButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 11, height: 38, backgroundColor: "#EEF4FF", borderRadius: 19 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2563EB" }, liveText: { color: "#2563EB", fontSize: 12, fontWeight: "800" }, iconAction: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E5EA", alignItems: "center", justifyContent: "center" }, memoryBar: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#EEF4FF", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 13 }, memoryText: { flex: 1, color: "#46516C", fontSize: 12, lineHeight: 18, textAlign: "right" }, messageArea: { flex: 1, minHeight: 0 }, messageList: { gap: 17, paddingTop: 6, paddingBottom: 14 }, messageRow: { width: "100%" }, userRow: { alignItems: "flex-start" }, assistantRow: { alignItems: "flex-end" }, message: { maxWidth: "91%", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, gap: 8 }, userMessage: { backgroundColor: "#2563EB", borderBottomLeftRadius: 5 }, assistantMessage: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E9ED", borderBottomRightRadius: 5 }, errorMessage: { borderColor: "#E9B1BB", backgroundColor: "#FFF8F8" }, messageTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, role: { color: "#2563EB", fontSize: 11, fontWeight: "800" }, userRole: { color: "#DCEBFF" }, soundButton: { width: 29, height: 29, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#F4F4F6" }, messageText: { color: "#292930", fontSize: 15, lineHeight: 24, textAlign: "right" }, userMessageText: { color: "#FFFFFF" }, insight: { backgroundColor: "#F5F8FF", borderRadius: 10, padding: 10, gap: 3 }, insightLabel: { color: "#2563EB", fontSize: 10, fontWeight: "800", textAlign: "right" }, insightText: { color: "#555563", fontSize: 12, lineHeight: 18, textAlign: "right" }, confidence: { color: "#73737D", fontSize: 10, textAlign: "right" }, thinking: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 5 }, thinkingText: { color: "#72727B", fontSize: 12 }, voiceNote: { color: "#2563EB", fontSize: 11, textAlign: "right", paddingHorizontal: 5, paddingBottom: 7 }, composer: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 7, backgroundColor: "#FFFFFF", borderColor: "#DCDCE1", borderWidth: 1, borderRadius: 22, paddingHorizontal: 8, paddingVertical: 7, shadowColor: "#1E293B", shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, composerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, recording: { backgroundColor: "#D63D52" }, input: { flex: 1, minHeight: 39, maxHeight: 110, color: "#1F1F23", fontSize: 15, lineHeight: 21, textAlign: "right", paddingTop: 8, paddingHorizontal: 3 }, sendButton: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: "#2563EB" }, sendDisabled: { backgroundColor: "#C8C8CE" }, disclaimer: { color: "#8B8B94", textAlign: "center", fontSize: 10, paddingVertical: 8 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] }
});
