import { File, Paths } from "expo-file-system";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { selectDeviceVoice } from "@/lib/device-voices";
import { haptic } from "@/lib/haptics";
import { freeModels, rebelGpts, useRebelStore, type ChatMessage } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

const getMimeType = () => Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

const taskCards = [
  { code: "01", tone: "blue", title: "اكتب بوضوح", detail: "رسالة أو محتوى", prompt: "ساعدني في كتابة نص واضح ومناسب لهذا الهدف: " },
  { code: "02", tone: "violet", title: "حلّل وقارن", detail: "خيارات وقرار", prompt: "حلّل الخيارات التالية، وقارن بينها بوضوح مع افتراضات وحدود كل خيار: " },
  { code: "03", tone: "mint", title: "خطّة عملية", detail: "خطوات قابلة للتنفيذ", prompt: "حوّل هذا الهدف إلى خطة عملية قصيرة بخطوات واضحة: " },
  { code: "04", tone: "amber", title: "اشرح وبسّط", detail: "تعلم وفهم", prompt: "اشرح هذا الموضوع ببساطة، ثم أعطني مثالاً وخطوة تالية: " },
] as const;

export default function ChatScreen() {
  const router = useRouter();
  const { messages, addMessage, replaceMessages, preferences, updatePreferences } = useRebelStore();
  const [draft, setDraft] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [showTools, setShowTools] = useState(true);
  const [showKeyOffer, setShowKeyOffer] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState<ChatMessage[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const chat = trpc.assistant.chat.useMutation();
  const transcription = trpc.voice.transcribe.useMutation();
  const conversations = trpc.cloud.conversations.list.useQuery();
  const projects = trpc.cloud.projects.list.useQuery();
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>();
  const cloudMessages = trpc.cloud.conversations.messages.useQuery({ conversationId: activeConversationId ?? 0 }, { enabled: Boolean(activeConversationId) });
  const activeGpt = useMemo(() => rebelGpts.find((gpt) => gpt.id === preferences.selectedGptId) ?? rebelGpts[0], [preferences.selectedGptId]);
  const activeModel = useMemo(() => freeModels.find((model) => model.id === preferences.selectedModel) ?? freeModels[0], [preferences.selectedModel]);
  const activeProject = useMemo(() => projects.data?.find((project) => project.id === preferences.activeProjectId), [preferences.activeProjectId, projects.data]);
  const visibleMessages = preferences.temporaryChat ? temporaryMessages : messages;
  const cloudError = !preferences.temporaryChat && (conversations.isError || projects.isError || cloudMessages.isError);

  const retryCloud = useCallback(() => {
    conversations.refetch();
    projects.refetch();
    if (activeConversationId) cloudMessages.refetch();
  }, [activeConversationId, cloudMessages, conversations, projects]);

  useEffect(() => {
    if (!preferences.temporaryChat && !activeConversationId && conversations.data?.[0]) setActiveConversationId(conversations.data[0].id);
  }, [activeConversationId, conversations.data, preferences.temporaryChat]);

  useEffect(() => {
    if (preferences.temporaryChat || !cloudMessages.data) return;
    replaceMessages(cloudMessages.data.map((message) => ({
      id: `cloud_${message.id}`,
      role: message.role,
      text: message.content,
      createdAt: message.createdAt.toISOString(),
      model: freeModels.some((model) => model.id === message.model) ? message.model as ChatMessage["model"] : undefined,
    })));
  }, [cloudMessages.data, preferences.temporaryChat, replaceMessages]);

  const speak = useCallback(async (text: string) => {
    const available = await Speech.getAvailableVoicesAsync().catch(() => []);
    const nativeVoice = selectDeviceVoice(available, preferences.selectedNativeVoiceId, preferences.preferredLanguage);
    if (await Speech.isSpeakingAsync().catch(() => false)) { await Speech.stop(); return; }
    Speech.speak(text, { language: nativeVoice?.language ?? preferences.preferredLanguage, voice: nativeVoice?.identifier, rate: 0.96, pitch: 1, onError: () => Alert.alert("تعذر تشغيل الصوت", "تأكد من توفر صوت نص إلى كلام في إعدادات جهازك.") });
  }, [preferences.preferredLanguage, preferences.selectedNativeVoiceId]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || chat.isPending) return;
    haptic.light();
    setDraft("");
    setVoiceNote("");
    const appendMessage = (message: Omit<ChatMessage, "id" | "createdAt">) => {
      if (preferences.temporaryChat) {
        setTemporaryMessages((current) => [...current, { ...message, id: `temporary_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }]);
      } else {
        addMessage(message);
      }
    };
    appendMessage({ role: "user", text });
    try {
      const result = await chat.mutateAsync({ message: text, conversationId: preferences.temporaryChat ? undefined : activeConversationId, projectId: preferences.temporaryChat ? undefined : preferences.activeProjectId, temporary: preferences.temporaryChat, memories: [], language: preferences.textLanguage, model: preferences.selectedModel, gptId: activeGpt.id });
      appendMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence, model: result.model, evidence: "evidence" in result ? result.evidence : undefined });
      if ("keyOfferEligible" in result && result.keyOfferEligible) setShowKeyOffer(true);
      if (typeof result.conversationId === "number") {
        setActiveConversationId(result.conversationId);
        conversations.refetch();
      }
      haptic.success();
    } catch (error) {
      const reason = error instanceof Error && error.message.includes("مفتاح")
        ? error.message
        : "تعذر إتمام التحليل الآن. تحقق من الاتصال ثم أعد المحاولة.";
      appendMessage({ role: "assistant", text: reason, isError: true });
      haptic.warning();
    }
  }, [activeConversationId, activeGpt.id, addMessage, chat, conversations, draft, preferences.activeProjectId, preferences.selectedModel, preferences.temporaryChat, preferences.textLanguage]);

  const toggleRecording = useCallback(async () => {
    if (Platform.OS === "web") { setVoiceNote("التسجيل الصوتي يُختبر من تطبيق Android المثبت. يمكنك المتابعة بالكتابة هنا."); return; }
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        await new Promise((resolve) => setTimeout(resolve, 180));
        const audioUri = recorder.uri;
        if (!audioUri) throw new Error("missing audio");
        const audioFile = new File(audioUri);
        if (!audioFile.exists || audioFile.size <= 0) throw new Error("audio file unavailable");
        setVoiceNote("أحوّل كلامك إلى نص…");
        const result = await transcription.mutateAsync({ audioBase64: await audioFile.base64(), mimeType: getMimeType(), language: preferences.preferredLanguage });
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
  }, [preferences.preferredLanguage, recorder, recorderState.isRecording, transcription]);

  const copyResponse = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setVoiceNote("تم نسخ الرد. يمكنك لصقه في أي تطبيق.");
      haptic.success();
    } catch {
      setVoiceNote("تعذر نسخ الرد الآن.");
      haptic.warning();
    }
  }, []);

  const shareResponse = useCallback(async (text: string) => {
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(text);
        setVoiceNote("المشاركة من الويب غير مضمونة؛ نُسخ الرد إلى الحافظة بدلاً من ذلك.");
        return;
      }
      const file = new File(Paths.cache, `rebel-response-${Date.now()}.txt`);
      file.create({ overwrite: true });
      file.write(text);
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, { mimeType: "text/plain", dialogTitle: "مشاركة رد من Rebel AI" });
      haptic.success();
    } catch {
      setVoiceNote("تعذر فتح المشاركة الآن. جرّب نسخ الرد بدلاً من ذلك.");
      haptic.warning();
    }
  }, []);

  const rewriteResponse = useCallback((text: string, style: "رسمية" | "مبسطة" | "مصرية") => {
    const directions = { رسمية: "بلغة رسمية واضحة", مبسطة: "بلغة أبسط مع الحفاظ على المعنى", مصرية: "بالمصرية الطبيعية والمحترمة" } as const;
    void sendMessage(`أعد صياغة النص التالي ${directions[style]} فقط، من دون إضافة حقائق جديدة:\n\n${text}`);
  }, [sendMessage]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const messageModel = item.model ? freeModels.find((model) => model.id === item.model) : activeModel;
    return <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}><View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, item.isError && styles.errorMessage]}>{item.role === "assistant" ? <View style={styles.assistantTop}><View style={[styles.assistantMark, { backgroundColor: activeGpt.color }]}><Text style={styles.assistantMarkText}>{activeGpt.shortName.slice(0, 1)}</Text></View><Text style={styles.role}>{activeGpt.name}</Text><View style={styles.modelBadge}><Text style={styles.modelBadgeText}>{messageModel?.shortName}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="قراءة الرد بصوت" onPress={() => speak(item.text)} style={({ pressed }) => [styles.soundButton, pressed && styles.pressed]}><IconSymbol name="speaker.wave.2.fill" size={17} color="#65656E" /></Pressable></View> : null}<Text style={[styles.messageText, item.role === "user" && styles.userMessageText]}>{item.text}</Text>{item.insight ? <Text style={styles.insightText}>{item.insight}</Text> : null}{item.evidence ? <View style={styles.evidenceCard}><Text style={styles.evidenceTitle}>دليل وسياق الرد</Text><Text style={styles.evidenceLine}>اعتمد على: {item.evidence.basis.join(" · ")}</Text><Text style={styles.evidenceLine}>افتراض: {item.evidence.assumptions[0]}</Text><Text style={styles.evidenceLimit}>حدود: {item.evidence.limitations[0]}</Text></View> : null}{item.role === "assistant" && !item.isError ? <View style={styles.messageActions}><Text style={styles.actionCaption}>إجراءات الرد</Text><View style={styles.primaryActionRow}><Pressable accessibilityRole="button" onPress={() => copyResponse(item.text)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Text style={styles.primaryActionText}>نسخ الرد</Text></Pressable><Pressable accessibilityRole="button" onPress={() => shareResponse(item.text)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Text style={styles.secondaryActionText}>مشاركة</Text></Pressable></View><View style={styles.rewriteActions}><Text style={styles.rewriteLabel}>إعادة الصياغة</Text><Pressable accessibilityRole="button" onPress={() => rewriteResponse(item.text, "مبسطة")} style={({ pressed }) => [styles.rewriteAction, pressed && styles.pressed]}><Text style={styles.rewriteActionText}>مبسطة</Text></Pressable><Pressable accessibilityRole="button" onPress={() => rewriteResponse(item.text, "مصرية")} style={({ pressed }) => [styles.rewriteAction, pressed && styles.pressed]}><Text style={styles.rewriteActionText}>مصرية</Text></Pressable><Pressable accessibilityRole="button" onPress={() => rewriteResponse(item.text, "رسمية")} style={({ pressed }) => [styles.rewriteAction, pressed && styles.pressed]}><Text style={styles.rewriteActionText}>رسمية</Text></Pressable></View></View> : null}</View></View>;
  };

  return <ScreenContainer className="px-4" containerClassName="bg-background" safeAreaClassName="bg-background"><KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="فتح Rebel GPTs" onPress={() => router.push("/gpts" as never)} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}><IconSymbol name="square.grid.2x2.fill" size={22} color="#161618" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="إدارة المشاريع" onPress={() => router.push("/projects" as never)} style={({ pressed }) => [styles.headerIcon, activeProject && styles.headerIconActive, pressed && styles.pressed]}><IconSymbol name="folder.fill" size={21} color={activeProject ? "#2563EB" : "#161618"} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="اختيار النموذج" onPress={() => router.push("/providers" as never)} style={({ pressed }) => [styles.gptPicker, pressed && styles.pressed]}><Text style={styles.gptPickerText}>{activeModel.shortName}</Text><Text style={styles.gptPickerArrow}>⌄</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="فتح Rebal Live" onPress={() => router.push("/call" as never)} style={({ pressed }) => [styles.liveRound, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={20} color="#2563EB" /></Pressable></View>
    <View style={styles.contextRow}><Pressable accessibilityRole="switch" accessibilityState={{ checked: preferences.temporaryChat }} onPress={() => { updatePreferences({ temporaryChat: !preferences.temporaryChat }); haptic.medium(); }} style={[styles.temporaryToggle, preferences.temporaryChat && styles.temporaryToggleActive]}><IconSymbol name="shield" size={15} color={preferences.temporaryChat ? "#9A6413" : "#74747C"} /><Text style={[styles.contextText, preferences.temporaryChat && styles.contextTextActive]}>{preferences.temporaryChat ? "محادثة مؤقتة: لا تُحفظ" : activeProject ? `المشروع: ${activeProject.name}` : "ذاكرة الحساب وفق إعداداتك"}</Text></Pressable></View>
    {cloudError ? <View style={styles.cloudError}><View style={styles.cloudErrorCopy}><Text style={styles.cloudErrorTitle}>تعذر تحديث السجل أو المشاريع الآن</Text><Text style={styles.cloudErrorText}>يمكنك متابعة المحادثة، ثم اضغط إعادة المحاولة بعد التحقق من الاتصال.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="إعادة محاولة تحميل بيانات الحساب" onPress={retryCloud} style={({ pressed }) => [styles.cloudRetry, pressed && styles.pressed]}><Text style={styles.cloudRetryText}>إعادة المحاولة</Text></Pressable></View> : null}
    <View style={styles.messageArea}><FlatList data={visibleMessages} renderItem={renderMessage} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} showsVerticalScrollIndicator={false} ListEmptyComponent={preferences.temporaryChat ? <View style={styles.temporaryEmpty}><Text style={styles.temporaryEmptyTitle}>محادثة مؤقتة</Text><Text style={styles.temporaryEmptyText}>لن تُحفظ هذه الرسائل في السجل أو الذاكرة، وتختفي عند مغادرة التطبيق أو تغيير الوضع.</Text></View> : null} ListFooterComponent={chat.isPending ? <View style={styles.thinking}><ActivityIndicator color="#2563EB" size="small" /><Text style={styles.thinkingText}>أرتّب السياق والأدلة…</Text></View> : null} /></View>
    {showKeyOffer ? <View style={styles.composer}><IconSymbol name="key.fill" size={20} color="#2563EB" /><View style={styles.toolShelf}><Text style={styles.toolText}>استخدم مفتاحك الشخصي</Text><Text style={styles.thinkingText}>اختياري للمستخدم المتقدم. يُختبر المفتاح أولاً، ويُحفظ مشفّراً للحساب نفسه فقط، ويمكن حذفه في أي وقت.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="فتح إعدادات المفتاح الشخصي" onPress={() => { setShowKeyOffer(false); router.push("/keys" as never); }} style={({ pressed }) => [styles.gptPicker, pressed && styles.pressed]}><Text style={styles.gptPickerText}>إضافة</Text><IconSymbol name="chevron.right" size={16} color="#2563EB" /></Pressable></View> : null}
    {voiceNote ? <Text style={styles.voiceNote}>{voiceNote}</Text> : null}
    {showTools ? <View style={styles.toolShelf}><View style={styles.tasksHeader}><View style={styles.tasksHeaderCopy}><Text style={styles.tasksEyebrow}>START WITH A FOCUS</Text><Text style={styles.tasksTitle}>ماذا تريد أن ننجز؟</Text></View><View style={styles.tasksBadge}><Text style={styles.tasksBadgeText}>4 مهام</Text></View></View><View style={styles.taskGrid}>{taskCards.map((task) => <Pressable key={task.title} accessibilityRole="button" onPress={() => { setDraft(task.prompt); setShowTools(false); haptic.light(); }} style={({ pressed }) => [styles.taskCard, task.tone === "blue" && styles.taskCardBlue, task.tone === "violet" && styles.taskCardViolet, task.tone === "mint" && styles.taskCardMint, task.tone === "amber" && styles.taskCardAmber, pressed && styles.pressed]}><View style={styles.taskTop}><Text style={styles.taskCode}>{task.code}</Text><Text style={styles.taskOpen}>ابدأ ←</Text></View><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskDetail}>{task.detail}</Text></Pressable>)}</View><View style={styles.toolDivider} /><Pressable onPress={() => { updatePreferences({ temporaryChat: true, activeProjectId: undefined }); setTemporaryMessages([]); haptic.medium(); }} style={styles.toolAction}><IconSymbol name="shield" size={21} color="#52525B" /><Text style={styles.toolText}>ابدأ محادثة مؤقتة</Text></Pressable><Pressable onPress={() => router.push("/projects" as never)} style={styles.toolAction}><IconSymbol name="folder.fill" size={21} color="#52525B" /><Text style={styles.toolText}>المشاريع والملفات القادمة</Text></Pressable></View> : null}
    <View style={styles.composer}><Pressable accessibilityRole="button" accessibilityLabel="إظهار أو إخفاء أدوات الإدخال" onPress={() => setShowTools((value) => !value)} style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}><IconSymbol name="plus.circle.fill" size={28} color="#232326" /></Pressable><TextInput accessibilityLabel="اكتب رسالتك إلى Rebel AI" value={draft} onChangeText={setDraft} onSubmitEditing={() => sendMessage()} placeholder={`اسأل ${activeGpt.name}`} placeholderTextColor="#8B8B95" multiline returnKeyType="send" style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"} onPress={toggleRecording} disabled={transcription.isPending || chat.isPending} style={({ pressed }) => [styles.composerIcon, recorderState.isRecording && styles.recording, pressed && styles.pressed]}><IconSymbol name="mic.fill" size={22} color={recorderState.isRecording ? "#FFFFFF" : "#202025"} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="إرسال" onPress={() => sendMessage()} disabled={!draft.trim() || chat.isPending} style={({ pressed }) => [styles.sendButton, (!draft.trim() || chat.isPending) && styles.sendDisabled, pressed && styles.pressed]}><IconSymbol name="arrow.up.circle.fill" size={29} color="#FFFFFF" /></Pressable></View>
    <Text style={styles.disclaimer}>قد يخطئ Rebel AI. راجع المعلومات المهمة قبل اتخاذ قرار.</Text>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  evidenceCard: { backgroundColor: "#F6FAFF", borderColor: "#D8E9FF", borderWidth: 1, borderRadius: 13, marginTop: 4, padding: 10, gap: 4 }, evidenceTitle: { color: "#245B9E", fontSize: 11, fontWeight: "900", textAlign: "right" }, evidenceLine: { color: "#4A668A", fontSize: 10, lineHeight: 15, textAlign: "right" }, evidenceLimit: { color: "#85652B", fontSize: 10, lineHeight: 15, textAlign: "right" }, tasksHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingTop: 3, paddingBottom: 10 }, tasksHeaderCopy: { alignItems: "flex-end", gap: 2 }, tasksEyebrow: { color: "#9A9AA3", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 }, tasksTitle: { color: "#24242A", fontSize: 17, fontWeight: "900", textAlign: "right" }, tasksBadge: { backgroundColor: "#EEF4FF", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5 }, tasksBadgeText: { color: "#2563EB", fontSize: 10, fontWeight: "900" }, taskGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, paddingHorizontal: 2, paddingBottom: 12 }, taskCard: { width: "48%", minHeight: 104, borderWidth: 1, borderRadius: 17, padding: 12, justifyContent: "space-between", shadowColor: "#1E293B", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, taskCardBlue: { backgroundColor: "#F3F7FF", borderColor: "#D9E7FF" }, taskCardViolet: { backgroundColor: "#F8F5FF", borderColor: "#E8DEFF" }, taskCardMint: { backgroundColor: "#F1FBF8", borderColor: "#D5F2E8" }, taskCardAmber: { backgroundColor: "#FFF9EF", borderColor: "#F4E7C7" }, taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, taskCode: { color: "#767680", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, taskOpen: { color: "#2563EB", fontSize: 10, fontWeight: "900" }, taskTitle: { color: "#24242A", fontSize: 14, fontWeight: "900", textAlign: "right" }, taskDetail: { color: "#74747C", fontSize: 10, textAlign: "right" }, toolDivider: { height: 1, backgroundColor: "#ECECEF", marginHorizontal: 6, marginBottom: 6 }, messageActions: { backgroundColor: "#FAFBFD", borderColor: "#E8EBF0", borderWidth: 1, borderRadius: 14, marginTop: 8, padding: 9, gap: 8 }, actionCaption: { color: "#8A8A93", fontSize: 9, fontWeight: "900", letterSpacing: 0.5, textAlign: "right" }, primaryActionRow: { flexDirection: "row-reverse", gap: 7 }, primaryAction: { flex: 1, backgroundColor: "#2563EB", borderRadius: 10, paddingVertical: 8, alignItems: "center" }, primaryActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, secondaryAction: { minWidth: 86, borderWidth: 1, borderColor: "#DCE4F4", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, alignItems: "center" }, secondaryActionText: { color: "#3C5688", fontSize: 11, fontWeight: "900" }, rewriteActions: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: 6 }, rewriteLabel: { color: "#74747D", fontSize: 10, fontWeight: "800", marginLeft: 2 }, rewriteAction: { backgroundColor: "#F0F3F8", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, rewriteActionText: { color: "#526075", fontSize: 10, fontWeight: "800" },
  page: { flex: 1, paddingTop: 8 }, header: { height: 54, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, headerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECECEF", alignItems: "center", justifyContent: "center" }, headerIconActive: { backgroundColor: "#EEF4FF", borderColor: "#B6D0FF" }, gptPicker: { flexDirection: "row-reverse", alignItems: "center", gap: 7, paddingHorizontal: 10, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF" }, gptPickerText: { color: "#171719", fontSize: 13, fontWeight: "800" }, gptPickerArrow: { color: "#5D5D65", fontSize: 17, marginTop: -4 }, liveRound: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center" }, contextRow: { alignItems: "flex-end", marginBottom: 2 }, temporaryToggle: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: "#F4F4F6" }, temporaryToggleActive: { backgroundColor: "#FFF4DB" }, contextText: { color: "#74747C", fontSize: 10, fontWeight: "700" }, contextTextActive: { color: "#9A6413" }, cloudError: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#FFF8E8", borderColor: "#F0D9A8", borderWidth: 1, borderRadius: 13, padding: 10, marginBottom: 4 }, cloudErrorCopy: { flex: 1, gap: 3 }, cloudErrorTitle: { color: "#8B5A10", fontSize: 12, fontWeight: "800", textAlign: "right" }, cloudErrorText: { color: "#8B6A39", fontSize: 10, lineHeight: 15, textAlign: "right" }, cloudRetry: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: "#E8C77E" }, cloudRetryText: { color: "#8B5A10", fontSize: 10, fontWeight: "800" }, messageArea: { flex: 1, minHeight: 0 }, messageList: { gap: 20, paddingTop: 18, paddingBottom: 16 }, messageRow: { width: "100%" }, userRow: { alignItems: "flex-start" }, assistantRow: { alignItems: "stretch" }, message: { gap: 8 }, userMessage: { maxWidth: "82%", alignSelf: "flex-start", backgroundColor: "#EDEDEF", borderRadius: 21, borderBottomLeftRadius: 6, paddingHorizontal: 15, paddingVertical: 11 }, assistantMessage: { paddingHorizontal: 3, paddingVertical: 2 }, errorMessage: { backgroundColor: "#FFF5F6", borderRadius: 14, padding: 12 }, assistantTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 }, assistantMark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" }, assistantMarkText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, role: { color: "#303036", fontSize: 13, fontWeight: "800", flex: 1, textAlign: "right" }, modelBadge: { backgroundColor: "#EEF4FF", borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 }, modelBadgeText: { color: "#2563EB", fontSize: 9, fontWeight: "800" }, soundButton: { width: 30, height: 30, justifyContent: "center", alignItems: "center", borderRadius: 15, backgroundColor: "#F3F3F5" }, messageText: { color: "#25252A", fontSize: 16, lineHeight: 28, textAlign: "right" }, userMessageText: { color: "#27272C", fontSize: 15, lineHeight: 24 }, insightText: { color: "#7A7A83", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 4 }, thinking: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 4 }, thinkingText: { color: "#74747C", fontSize: 12 }, temporaryEmpty: { backgroundColor: "#FFF8E8", borderColor: "#F0D9A8", borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 }, temporaryEmptyTitle: { color: "#8B5A10", fontSize: 15, fontWeight: "900", textAlign: "right" }, temporaryEmptyText: { color: "#8B6A39", fontSize: 12, lineHeight: 18, textAlign: "right", marginTop: 5 }, voiceNote: { color: "#2563EB", fontSize: 11, textAlign: "center", paddingHorizontal: 5, paddingBottom: 7 }, toolShelf: { gap: 3, paddingHorizontal: 6, paddingBottom: 12 }, toolAction: { flexDirection: "row-reverse", alignItems: "center", gap: 12, height: 46, paddingHorizontal: 12 }, toolText: { color: "#5A5A62", fontSize: 15, textAlign: "right" }, composer: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: "#FFFFFF", borderColor: "#E1E1E5", borderWidth: 1, borderRadius: 28, paddingHorizontal: 8, paddingVertical: 7, shadowColor: "#1E293B", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, plusButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, composerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, recording: { backgroundColor: "#D63D52" }, input: { flex: 1, minHeight: 40, maxHeight: 100, color: "#1F1F23", fontSize: 16, lineHeight: 22, textAlign: "right", paddingTop: 8, paddingHorizontal: 3 }, sendButton: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: "#1F1F23" }, sendDisabled: { backgroundColor: "#CFCFD4" }, disclaimer: { color: "#8A8A92", textAlign: "center", fontSize: 10, paddingVertical: 7 }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] }
});
