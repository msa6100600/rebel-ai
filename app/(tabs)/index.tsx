import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { freeModels, rebelGpts, voiceProfiles, useRebelStore, type ChatMessage } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

const getMimeType = () => Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

export default function ChatScreen() {
  const router = useRouter();
  const { messages, addMessage, replaceMessages, preferences } = useRebelStore();
  const [draft, setDraft] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [showTools, setShowTools] = useState(true);
  const [showKeyOffer, setShowKeyOffer] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const chat = trpc.assistant.chat.useMutation();
  const transcription = trpc.voice.transcribe.useMutation();
  const conversations = trpc.cloud.conversations.list.useQuery();
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>();
  const cloudMessages = trpc.cloud.conversations.messages.useQuery({ conversationId: activeConversationId ?? 0 }, { enabled: Boolean(activeConversationId) });
  const selectedVoice = useMemo(() => voiceProfiles.find((voice) => voice.id === preferences.selectedVoiceId) ?? voiceProfiles[0], [preferences.selectedVoiceId]);
  const activeGpt = useMemo(() => rebelGpts.find((gpt) => gpt.id === preferences.selectedGptId) ?? rebelGpts[0], [preferences.selectedGptId]);
  const activeModel = useMemo(() => freeModels.find((model) => model.id === preferences.selectedModel) ?? freeModels[0], [preferences.selectedModel]);

  useEffect(() => {
    if (!activeConversationId && conversations.data?.[0]) setActiveConversationId(conversations.data[0].id);
  }, [activeConversationId, conversations.data]);

  useEffect(() => {
    if (!cloudMessages.data) return;
    replaceMessages(cloudMessages.data.map((message) => ({
      id: `cloud_${message.id}`,
      role: message.role,
      text: message.content,
      createdAt: message.createdAt.toISOString(),
      model: freeModels.some((model) => model.id === message.model) ? message.model as ChatMessage["model"] : undefined,
    })));
  }, [cloudMessages.data, replaceMessages]);

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
      const result = await chat.mutateAsync({ message: text, conversationId: activeConversationId, memories: [], language: selectedVoice.language, model: preferences.selectedModel, gptId: activeGpt.id });
      addMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence, model: result.model });
      if ("keyOfferEligible" in result && result.keyOfferEligible) setShowKeyOffer(true);
      setActiveConversationId(result.conversationId);
      conversations.refetch();
      haptic.success();
    } catch {
      addMessage({ role: "assistant", text: "تعذر إتمام التحليل الآن. لم يتم حفظ أي معلومة. أعد المحاولة بعد التحقق من الاتصال.", isError: true });
      haptic.warning();
    }
  }, [activeConversationId, activeGpt.id, addMessage, chat, conversations, draft, preferences.selectedModel, selectedVoice.language]);

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

  const renderMessage = ({ item }: { item: ChatMessage }) => { const messageModel = item.model ? freeModels.find((model) => model.id === item.model) : activeModel; return <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}><View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, item.isError && styles.errorMessage]}>{item.role === "assistant" ? <View style={styles.assistantTop}><View style={[styles.assistantMark, { backgroundColor: activeGpt.color }]}><Text style={styles.assistantMarkText}>{activeGpt.shortName.slice(0, 1)}</Text></View><Text style={styles.role}>{activeGpt.name}</Text><View style={styles.modelBadge}><Text style={styles.modelBadgeText}>{messageModel?.shortName}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="قراءة الرد بصوت" onPress={() => speak(item.text)} style={({ pressed }) => [styles.soundButton, pressed && styles.pressed]}><IconSymbol name="speaker.wave.2.fill" size={17} color="#65656E" /></Pressable></View> : null}<Text style={[styles.messageText, item.role === "user" && styles.userMessageText]}>{item.text}</Text>{item.insight ? <Text style={styles.insightText}>{item.insight}</Text> : null}</View></View>; };

  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="فتح Rebel GPTs" onPress={() => router.push("/gpts" as never)} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}><IconSymbol name="square.grid.2x2.fill" size={22} color="#161618" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="اختيار النموذج" onPress={() => router.push("/providers" as never)} style={({ pressed }) => [styles.gptPicker, pressed && styles.pressed]}><Text style={styles.gptPickerText}>{activeModel.shortName}</Text><Text style={styles.gptPickerArrow}>⌄</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="فتح Rebal Live" onPress={() => router.push("/call" as never)} style={({ pressed }) => [styles.liveRound, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={20} color="#2563EB" /></Pressable></View>
    <View style={styles.messageArea}><FlatList data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false} ListFooterComponent={chat.isPending ? <View style={styles.thinking}><ActivityIndicator color="#2563EB" size="small" /><Text style={styles.thinkingText}>أرتّب السياق والأدلة…</Text></View> : null} /></View>
    {showKeyOffer ? <View style={styles.composer}><IconSymbol name="key.fill" size={20} color="#2563EB" /><View style={styles.toolShelf}><Text style={styles.toolText}>استخدم مفتاحك الشخصي</Text><Text style={styles.thinkingText}>اختياري للمستخدم المتقدم. يُختبر المفتاح أولاً، ويُحفظ مشفّراً للحساب نفسه فقط، ويمكن حذفه في أي وقت.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="فتح إعدادات المفتاح الشخصي" onPress={() => { setShowKeyOffer(false); router.push("/keys" as never); }} style={({ pressed }) => [styles.gptPicker, pressed && styles.pressed]}><Text style={styles.gptPickerText}>إضافة</Text><IconSymbol name="chevron.right" size={16} color="#2563EB" /></Pressable></View> : null}
    {voiceNote ? <Text style={styles.voiceNote}>{voiceNote}</Text> : null}
    {showTools ? <View style={styles.toolShelf}><Pressable onPress={() => Alert.alert("إنشاء صورة", "اكتب وصف الصورة في مربع المحادثة، ثم اختر خدمة الصور عند ربطها من المكونات الإضافية.")} style={styles.toolAction}><IconSymbol name="photo.fill" size={21} color="#52525B" /><Text style={styles.toolText}>أنشئ صورة</Text></Pressable><Pressable onPress={() => setDraft("ساعدني في كتابة: ")} style={styles.toolAction}><IconSymbol name="pencil" size={21} color="#52525B" /><Text style={styles.toolText}>الكتابة والتحرير</Text></Pressable><Pressable onPress={() => setDraft("ابحث في الويب عن: ")} style={styles.toolAction}><IconSymbol name="globe" size={21} color="#52525B" /><Text style={styles.toolText}>ابحث في الويب</Text></Pressable><Pressable onPress={() => router.push("/plugins" as never)} style={styles.toolAction}><IconSymbol name="puzzlepiece.extension.fill" size={21} color="#52525B" /><Text style={styles.toolText}>المكونات الإضافية</Text></Pressable></View> : null}
    <View style={styles.composer}><Pressable accessibilityRole="button" accessibilityLabel="إظهار أو إخفاء أدوات الإدخال" onPress={() => setShowTools((value) => !value)} style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}><IconSymbol name="plus.circle.fill" size={28} color="#232326" /></Pressable><TextInput accessibilityLabel="اكتب رسالتك إلى Rebel AI" value={draft} onChangeText={setDraft} onSubmitEditing={() => sendMessage()} placeholder={`اسأل ${activeGpt.name}`} placeholderTextColor="#8B8B95" multiline returnKeyType="send" style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"} onPress={toggleRecording} disabled={transcription.isPending || chat.isPending} style={({ pressed }) => [styles.composerIcon, recorderState.isRecording && styles.recording, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={22} color={recorderState.isRecording ? "#FFFFFF" : "#202025"} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="إرسال" onPress={() => sendMessage()} disabled={!draft.trim() || chat.isPending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || chat.isPending) && styles.sendDisabled, pressed && styles.pressed]}><IconSymbol name="arrow.up.circle.fill" size={29} color="#FFFFFF" /></Pressable></View>
    <Text style={styles.disclaimer}>قد يخطئ Rebel AI. راجع المعلومات المهمة قبل اتخاذ قرار.</Text>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 8 }, header: { height: 54, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, headerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECECEF", alignItems: "center", justifyContent: "center" }, gptPicker: { flexDirection: "row-reverse", alignItems: "center", gap: 7, paddingHorizontal: 14, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF" }, gptPickerText: { color: "#171719", fontSize: 16, fontWeight: "800" }, gptPickerArrow: { color: "#5D5D65", fontSize: 17, marginTop: -4 }, liveRound: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center" }, messageArea: { flex: 1, minHeight: 0 }, messageList: { gap: 20, paddingTop: 18, paddingBottom: 16 }, messageRow: { width: "100%" }, userRow: { alignItems: "flex-start" }, assistantRow: { alignItems: "stretch" }, message: { gap: 8 }, userMessage: { maxWidth: "82%", alignSelf: "flex-start", backgroundColor: "#EDEDEF", borderRadius: 21, borderBottomLeftRadius: 6, paddingHorizontal: 15, paddingVertical: 11 }, assistantMessage: { paddingHorizontal: 3, paddingVertical: 2 }, errorMessage: { backgroundColor: "#FFF5F6", borderRadius: 14, padding: 12 }, assistantTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, assistantMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" }, assistantMarkText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, role: { color: "#303036", fontSize: 13, fontWeight: "800", flex: 1, textAlign: "right" }, modelBadge: { backgroundColor: "#EEF4FF", borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 }, modelBadgeText: { color: "#2563EB", fontSize: 9, fontWeight: "800" }, soundButton: { width: 30, height: 30, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#F3F3F5" }, messageText: { color: "#25252A", fontSize: 16, lineHeight: 28, textAlign: "right" }, userMessageText: { color: "#27272C", fontSize: 15, lineHeight: 24 }, insightText: { color: "#7A7A83", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 4 }, thinking: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 4 }, thinkingText: { color: "#74747C", fontSize: 12 }, voiceNote: { color: "#2563EB", fontSize: 11, textAlign: "center", paddingHorizontal: 5, paddingBottom: 7 }, toolShelf: { gap: 3, paddingHorizontal: 6, paddingBottom: 12 }, toolAction: { flexDirection: "row-reverse", alignItems: "center", gap: 12, height: 46, paddingHorizontal: 12 }, toolText: { color: "#5A5A62", fontSize: 15, textAlign: "right" }, composer: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: "#FFFFFF", borderColor: "#E1E1E5", borderWidth: 1, borderRadius: 28, paddingHorizontal: 8, paddingVertical: 7, shadowColor: "#1E293B", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, plusButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, composerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, recording: { backgroundColor: "#D63D52" }, input: { flex: 1, minHeight: 40, maxHeight: 100, color: "#1F1F23", fontSize: 16, lineHeight: 22, textAlign: "right", paddingTop: 8, paddingHorizontal: 3 }, sendButton: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: "#1F1F23" }, sendDisabled: { backgroundColor: "#CFCFD4" }, disclaimer: { color: "#8A8A92", textAlign: "center", fontSize: 10, paddingVertical: 7 }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] }
});
