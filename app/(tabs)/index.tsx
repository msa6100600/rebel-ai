import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { IconButton, ScreenHeading, SectionTitle, StatusPill } from "@/components/rebel-ui";
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
  const [historyQuery, setHistoryQuery] = useState("");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const chat = trpc.assistant.chat.useMutation();
  const transcription = trpc.voice.transcribe.useMutation();
  const selectedVoice = useMemo(() => voiceProfiles.find((voice) => voice.id === preferences.selectedVoiceId) ?? voiceProfiles[0], [preferences.selectedVoiceId]);
  const filteredMessages = useMemo(() => messages.filter((message) => message.text.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase())), [historyQuery, messages]);

  const speak = useCallback(async (text: string) => {
    const available = await Speech.getAvailableVoicesAsync().catch(() => []);
    const nativeVoice = available.find((voice) => voice.language.toLowerCase().startsWith(selectedVoice.language.slice(0, 2).toLowerCase()));
    const alreadySpeaking = await Speech.isSpeakingAsync().catch(() => false);
    if (alreadySpeaking) {
      await Speech.stop();
      return;
    }
    Speech.speak(text, {
      language: selectedVoice.language,
      voice: nativeVoice?.identifier,
      rate: selectedVoice.rate,
      pitch: selectedVoice.pitch,
      onError: () => Alert.alert("تعذر تشغيل الصوت", "تأكد من توفر لغة الصوت المختارة في جهازك."),
    });
  }, [selectedVoice]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || chat.isPending) return;
    haptic.light();
    setDraft("");
    setVoiceNote(null);
    addMessage({ role: "user", text });
    try {
      const result = await chat.mutateAsync({
        message: text,
        memories: memories.slice(0, 8).map(({ title, content, category }) => ({ title, content, category })),
        language: selectedVoice.language,
        model: preferences.selectedModel as "gpt-5" | "gpt-5-mini" | "claude-sonnet-4-6" | "gemini-3.1-pro-preview",
      });
      addMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence });
      if (result.suggestedMemory && preferences.allowSuggestedLearning) {
        addApproval({
          title: `حفظ معرفة مقترحة: ${result.suggestedMemory.title}`,
          detail: result.suggestedMemory.content,
          type: "تعلم مقترح",
          memory: { ...result.suggestedMemory },
        });
      }
      haptic.success();
    } catch {
      addMessage({ role: "assistant", text: "تعذر إتمام التحليل الآن. لم يتم حفظ أي معلومة أو اقتراح إجراء. أعد المحاولة بعد التحقق من الاتصال.", isError: true });
      haptic.warning();
    }
  }, [addApproval, addMessage, chat, draft, memories, preferences.allowSuggestedLearning, preferences.selectedModel, selectedVoice.language]);

  const toggleRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      setVoiceNote("يُفضّل اختبار التسجيل من تطبيق Android بعد تثبيته. يمكنك المتابعة بالكتابة هنا.");
      return;
    }
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        const audioUri = recorder.uri;
        if (!audioUri) throw new Error("لا يوجد تسجيل صالح");
        setVoiceNote("أحوّل كلامك إلى نص…");
        const audioFile = new File(audioUri);
        const result = await transcription.mutateAsync({
          audioBase64: await audioFile.base64(),
          mimeType: getMimeType(),
          language: selectedVoice.language,
        });
        if (!result.ok || !result.text) throw new Error(result.ok ? "لم يُلتقط كلام واضح" : result.error);
        setDraft(result.text);
        setVoiceNote("تم تحويل التسجيل إلى نص. راجعه ثم أرسله.");
        haptic.success();
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceNote("يلزم السماح بالميكروفون لبدء محادثة صوتية. ما زال الإدخال النصي متاحاً.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceNote("جاري الاستماع… اضغط مرة أخرى عند الانتهاء.");
      haptic.medium();
    } catch {
      setVoiceNote("تعذر تسجيل الصوت أو تحويله. أعد المحاولة أو أرسل رسالتك كتابةً.");
      haptic.warning();
    }
  }, [recorder, recorderState.isRecording, selectedVoice.language, transcription]);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageRow, item.role === "user" ? styles.messageRowUser : styles.messageRowAssistant]}>
      <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble, item.isError && styles.errorBubble]}>
        <View style={styles.messageMeta}>
          <Text style={[styles.messageLabel, item.role === "user" && styles.userMessageLabel]}>{item.role === "user" ? "أنت" : "REBEL AI"}</Text>
          {item.role === "assistant" ? <IconButton icon="speaker.wave.2.fill" label="قراءة الرد بصوت" onPress={() => speak(item.text)} /> : null}
        </View>
        <Text style={[styles.messageText, item.role === "user" && styles.userMessageText]}>{item.text}</Text>
        {item.insight ? <View style={styles.insightBox}><Text style={styles.insightLabel}>نقطة تحليلية</Text><Text style={styles.insightText}>{item.insight}</Text></View> : null}
        {typeof item.confidence === "number" ? <View style={styles.confidenceRow}><Text style={styles.confidenceText}>درجة اليقين</Text><Text style={styles.confidenceValue}>{item.confidence}%</Text></View> : null}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background">
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScreenHeading
          eyebrow="ANALYTICAL COMPANION"
          title="Rebel AI"
          action={<View style={styles.headerActions}><Pressable accessibilityRole="button" accessibilityLabel="بدء Rebal Live" onPress={() => router.push("/call" as never)} style={({ pressed }) => [styles.callShortcut, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={18} color="#DDEBFF" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="فتح الموافقات" onPress={() => router.push("/approvals" as never)} style={({ pressed }) => [styles.approvalShortcut, pressed && styles.pressed]}><Text style={styles.approvalCount}>مراجعة</Text><Text style={styles.approvalNumber}>›</Text></Pressable></View>}
        />
        <View style={styles.contextCard}>
          <View style={styles.contextTop}><StatusPill tone="success" label="التحكم بيدك" /><Text style={styles.contextTitle}>ذاكرتك وسياقك</Text></View>
          <Text style={styles.contextText}>سأستخدم {memories.length} عناصر ذاكرة محفوظة في هذا الحوار. أي معرفة جديدة تُعرض عليك أولاً للموافقة.</Text>
        </View>
        {messages.length > 1 ? <View style={styles.historySearch}><IconButton icon="magnifyingglass" label="إلغاء بحث سجل المحادثة" onPress={() => setHistoryQuery("")} /><TextInput value={historyQuery} onChangeText={setHistoryQuery} placeholder="ابحث في سجل المحادثة…" placeholderTextColor="#7F8AAE" style={styles.historyInput} accessibilityLabel="بحث في سجل المحادثة" /></View> : null}
        <SectionTitle title="المحادثة" detail="تحليل • ربط • استنتاج" />
        <View style={styles.messageArea}><FlatList
          data={filteredMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={chat.isPending ? <View style={styles.thinking}><ActivityIndicator color="#44D7FF" /><Text style={styles.thinkingText}>أرتّب الأدلة والسياق…</Text></View> : null}
        /></View>
        {voiceNote ? <Text style={styles.voiceNote}>{voiceNote}</Text> : null}
        <View style={styles.composer}>
          <IconButton icon="mic.fill" label={recorderState.isRecording ? "إيقاف التسجيل" : "بدء محادثة صوتية"} active={recorderState.isRecording} onPress={toggleRecording} disabled={transcription.isPending || chat.isPending} />
          <TextInput
            accessibilityLabel="اكتب رسالتك إلى Rebel AI"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => sendMessage()}
            placeholder="اكتب ما تريد تحليله…"
            placeholderTextColor="#7F8AAE"
            multiline
            returnKeyType="send"
            style={styles.input}
          />
          <IconButton icon="arrow.up.circle.fill" label="إرسال الرسالة" active={Boolean(draft.trim())} onPress={() => sendMessage()} disabled={!draft.trim() || chat.isPending} />
        </View>
        <Text style={styles.footerHint}>المحرك: {preferences.selectedModel} · الصوت: {selectedVoice.name} · {selectedVoice.dialect}</Text>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 10 },
  headerActions: { flexDirection: "row-reverse", gap: 7, alignItems: "center" },
  callShortcut: { width: 40, height: 40, backgroundColor: "#264A64", alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "#3D789B" },
  approvalShortcut: { backgroundColor: "#201E43", flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: "#443D82" },
  approvalCount: { color: "#D9D2FF", fontWeight: "800", fontSize: 12 },
  approvalNumber: { color: "#44D7FF", fontWeight: "800", fontSize: 20, lineHeight: 20 },
  contextCard: { backgroundColor: "#121A31", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "#253557", gap: 9, marginBottom: 18 },
  contextTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contextTitle: { color: "#F5F7FF", fontSize: 16, fontWeight: "800", textAlign: "right" },
  contextText: { color: "#AEB7D6", fontSize: 13, lineHeight: 20, textAlign: "right" },
  historySearch: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#121A31", borderWidth: 1, borderColor: "#2B3B62", padding: 7, borderRadius: 15, marginBottom: 14 },
  historyInput: { flex: 1, minHeight: 34, color: "#F5F7FF", fontSize: 13, textAlign: "right" },
  list: { flex: 1 },
  messageArea: { flex: 1, minHeight: 0 },
  listContent: { gap: 12, paddingBottom: 12 },
  messageRow: { width: "100%" },
  messageRowUser: { alignItems: "flex-start" },
  messageRowAssistant: { alignItems: "flex-end" },
  bubble: { maxWidth: "91%", padding: 15, borderRadius: 18, gap: 9 },
  userBubble: { backgroundColor: "#6851DC", borderBottomLeftRadius: 5 },
  assistantBubble: { backgroundColor: "#151E38", borderWidth: 1, borderColor: "#27375C", borderBottomRightRadius: 5 },
  errorBubble: { borderColor: "#9B4655" },
  messageMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  messageLabel: { color: "#44D7FF", fontSize: 10, letterSpacing: 1.1, fontWeight: "900" },
  userMessageLabel: { color: "#E9E6FF" },
  messageText: { color: "#F5F7FF", fontSize: 15, lineHeight: 24, textAlign: "right" },
  userMessageText: { color: "#FFFFFF" },
  insightBox: { backgroundColor: "#1A2948", padding: 10, borderRadius: 11, gap: 3 },
  insightLabel: { color: "#77E2FF", fontSize: 10, fontWeight: "900", textAlign: "right" },
  insightText: { color: "#C8D2EE", fontSize: 12, lineHeight: 18, textAlign: "right" },
  confidenceRow: { flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#28385D", paddingTop: 8 },
  confidenceText: { color: "#AEB7D6", fontSize: 11, fontWeight: "700" },
  confidenceValue: { color: "#57E4AC", fontSize: 11, fontWeight: "900" },
  thinking: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 9, paddingVertical: 8 },
  thinkingText: { color: "#AEB7D6", fontSize: 12, fontWeight: "700" },
  voiceNote: { color: "#8EEBFF", fontSize: 12, lineHeight: 18, textAlign: "right", paddingHorizontal: 4, paddingBottom: 8 },
  composer: { flexDirection: "row-reverse", gap: 9, alignItems: "flex-end", backgroundColor: "#121A31", borderRadius: 18, padding: 9, borderWidth: 1, borderColor: "#2B3B62" },
  input: { flex: 1, maxHeight: 104, minHeight: 39, color: "#F5F7FF", fontSize: 15, lineHeight: 21, textAlign: "right", paddingTop: 8, paddingHorizontal: 4 },
  footerHint: { color: "#7683AA", fontSize: 10, lineHeight: 16, textAlign: "center", paddingTop: 7, paddingBottom: 4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
