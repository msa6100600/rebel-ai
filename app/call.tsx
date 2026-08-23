import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { voiceProfiles, useRebelStore } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

const getMimeType = () => Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

export default function CallScreen() {
  const router = useRouter();
  const { preferences, addMessage } = useRebelStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const chat = trpc.assistant.chat.useMutation();
  const transcription = trpc.voice.transcribe.useMutation();
  const selectedVoice = useMemo(() => voiceProfiles.find((voice) => voice.id === preferences.selectedVoiceId) ?? voiceProfiles[0], [preferences.selectedVoiceId]);
  const [status, setStatus] = useState<"connecting" | "ready" | "listening" | "thinking" | "speaking" | "ended">("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [lastHeard, setLastHeard] = useState("اضغط زر الميكروفون لبدء التحدث.");
  const [lastAnswer, setLastAnswer] = useState("سأستمع إلى رسالتك ثم أجيبك بصوت واضح.");
  const recordingRef = useRef(false);
  const pressActiveRef = useRef(false);

  useEffect(() => {
    const ready = setTimeout(() => setStatus("ready"), 700);
    return () => clearTimeout(ready);
  }, []);
  useEffect(() => {
    if (status === "ended") return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => () => { Speech.stop(); }, []);

  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const statusText = status === "connecting" ? "جارٍ تشغيل Rebal Live…" : status === "listening" ? "أستمع إليك الآن" : status === "thinking" ? "أحلل رسالتك…" : status === "speaking" ? "Rebel AI يتحدث" : status === "ended" ? "انتهت الجلسة" : "Rebal Live جاهز";

  const speakAnswer = async (text: string) => {
    const available = await Speech.getAvailableVoicesAsync().catch(() => []);
    const nativeVoice = available.find((voice) => voice.language.toLowerCase().startsWith(selectedVoice.language.slice(0, 2).toLowerCase()));
    setStatus("speaking");
    Speech.speak(text, { language: selectedVoice.language, voice: nativeVoice?.identifier, rate: selectedVoice.rate, pitch: selectedVoice.pitch, onDone: () => setStatus("ready"), onError: () => setStatus("ready") });
  };

  const startVoiceRecording = async () => {
    if (muted || status === "thinking") return;
    if (Platform.OS === "web") {
      Alert.alert("Rebal Live", "التسجيل يعمل من تطبيق Android بعد تثبيته. استخدم نسخة الهاتف لاختبار المحادثة الصوتية.");
      return;
    }
    try {
      if (recordingRef.current || recorderState.isRecording) return;
      if (status === "speaking") {
        await Speech.stop();
        setStatus("ready");
        setLastAnswer("تم إيقاف الرد لأنك بدأت جولة صوتية جديدة.");
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setLastHeard("يلزم السماح بالميكروفون لبدء Rebal Live.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setStatus("listening");
      setLastHeard("جاري الاستماع… ارفع إصبعك لإرسال ما قلته.");
      haptic.medium();
      if (!pressActiveRef.current) setTimeout(() => { finishVoiceTurn(); }, 0);
    } catch {
      recordingRef.current = false;
      setStatus("ready");
      setLastHeard("تعذر بدء التسجيل. تحقق من إذن الميكروفون ثم أعد المحاولة.");
      haptic.warning();
    }
  };

  const finishVoiceTurn = async () => {
    if (!recordingRef.current && !recorderState.isRecording) return;
    try {
      await recorder.stop();
      recordingRef.current = false;
      await new Promise((resolve) => setTimeout(resolve, 180));
      const audioUri = recorder.uri;
      if (!audioUri) throw new Error("missing audio");
      const audioFile = new File(audioUri);
      if (!audioFile.exists || audioFile.size <= 0) throw new Error("audio file unavailable");
      setStatus("thinking");
      const transcriptionResult = await transcription.mutateAsync({ audioBase64: await audioFile.base64(), mimeType: getMimeType(), language: selectedVoice.language });
      if (!transcriptionResult.ok || !transcriptionResult.text) throw new Error("empty transcription");
      setLastHeard(transcriptionResult.text);
      if (!preferences.temporaryChat) addMessage({ role: "user", text: transcriptionResult.text });
      const result = await chat.mutateAsync({ message: transcriptionResult.text, projectId: preferences.temporaryChat ? undefined : preferences.activeProjectId, temporary: preferences.temporaryChat, memories: [], language: selectedVoice.language, model: preferences.selectedModel, gptId: preferences.selectedGptId });
      if (!preferences.temporaryChat) addMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence, model: result.model });
      setLastAnswer(result.answer);
      haptic.success();
      await speakAnswer(result.answer);
    } catch {
      recordingRef.current = false;
      setStatus("ready");
      setLastAnswer("تعذر إتمام هذه الجولة الصوتية. تحقق من اتصال الإنترنت وجرّب مرة أخرى.");
      haptic.warning();
    }
  };

  const toggleMute = async () => {
    if (recorderState.isRecording) await recorder.stop().catch(() => undefined);
    recordingRef.current = false;
    pressActiveRef.current = false;
    setMuted((value) => !value);
    setStatus("ready");
    haptic.medium();
  };
  const endCall = async () => {
    if (recorderState.isRecording) await recorder.stop().catch(() => undefined);
    recordingRef.current = false;
    pressActiveRef.current = false;
    await Speech.stop();
    setStatus("ended");
    haptic.medium();
    setTimeout(() => router.back(), 250);
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <Text style={styles.eyebrow}>REBAL LIVE · PUSH-TO-TALK</Text><Text style={styles.timer}>{time}</Text><Text style={styles.status}>{statusText}</Text>{preferences.temporaryChat ? <Text style={styles.temporaryNote}>وضع مؤقت: لا تحفظ هذه الجولة في السجل أو الذاكرة.</Text> : null}
    <View style={[styles.orb, status === "listening" && styles.orbListening, status === "speaking" && styles.orbSpeaking]}><View style={styles.orbInner}><IconSymbol name="brain.head.profile" size={62} color="#2563EB" /></View></View>
    <View style={styles.identity}><Text style={styles.identityName}>{selectedVoice.name}</Text><Text style={styles.identityDetail}>{selectedVoice.dialect} · {selectedVoice.language}</Text></View>
    <View style={styles.transcriptCard}><Text style={styles.cardLabel}>أنت قلت</Text><Text style={styles.transcript}>{lastHeard}</Text></View><View style={styles.answerCard}><Text style={styles.cardLabel}>رد Rebel AI</Text><Text style={styles.answer}>{lastAnswer}</Text></View>
    <View style={styles.controls}><Pressable accessibilityRole="button" accessibilityLabel={muted ? "إلغاء كتم الميكروفون" : "كتم الميكروفون"} onPress={toggleMute} style={({ pressed }) => [styles.secondaryControl, muted && styles.mutedControl, pressed && styles.pressed]}><IconSymbol name={muted ? "mic.slash.fill" : "mic.fill"} size={25} color="#4E4E58" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? "حرر الزر لإرسال كلامك" : status === "speaking" ? "اضغط لمقاطعة الرد وبدء جولة جديدة" : "اضغط باستمرار للتحدث مع Rebal Live"} disabled={status === "thinking" || muted} onPressIn={() => { pressActiveRef.current = true; startVoiceRecording(); }} onPressOut={() => { pressActiveRef.current = false; finishVoiceTurn(); }} style={({ pressed }) => [styles.primaryControl, (recorderState.isRecording || pressed) && styles.recordingControl, muted && styles.disabled, pressed && styles.pressed]}>{status === "thinking" ? <ActivityIndicator color="#FFFFFF" /> : <IconSymbol name="mic.fill" size={30} color="#FFFFFF" />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="إنهاء Rebal Live" onPress={endCall} style={({ pressed }) => [styles.endControl, pressed && styles.pressed]}><IconSymbol name="xmark" size={23} color="#B2273E" /></Pressable></View><Text style={styles.hint}>{recorderState.isRecording ? "استمر بالضغط أثناء الحديث، ثم ارفع إصبعك لإرسال الجولة." : muted ? "الميكروفون مكتوم." : status === "speaking" ? "يمكنك الضغط على الميكروفون لمقاطعة الرد وبدء جولة جديدة." : "اضغط باستمرار وتحدث؛ عند الإفلات سيحلل Rebel AI كلامك ويرد بصوت قبل الجولة التالية."}</Text>
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({ page: { flex: 1, alignItems: "center", paddingTop: 22, gap: 10 }, eyebrow: { color: "#73737D", fontWeight: "800", letterSpacing: 1.4, fontSize: 10 }, timer: { color: "#1F1F23", fontSize: 35, fontWeight: "800", fontVariant: ["tabular-nums"] }, status: { color: "#74747C", fontSize: 14, fontWeight: "700" }, temporaryNote: { color: "#986517", fontSize: 10, fontWeight: "800", backgroundColor: "#FFF6E4", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }, orb: { width: 166, height: 166, borderRadius: 83, justifyContent: "center", alignItems: "center", marginVertical: 8, backgroundColor: "#EAF1FF", borderWidth: 8, borderColor: "#D7E6FF" }, orbListening: { backgroundColor: "#E6F7F3", borderColor: "#C5EBDD" }, orbSpeaking: { backgroundColor: "#EEF4FF", borderColor: "#CFE0FF" }, orbInner: { width: 106, height: 106, borderRadius: 53, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DFE7F5" }, identity: { alignItems: "center", gap: 3, marginBottom: 4 }, identityName: { color: "#26262C", fontSize: 19, fontWeight: "800" }, identityDetail: { color: "#777780", fontSize: 12 }, transcriptCard: { width: "100%", backgroundColor: "#FFFFFF", borderColor: "#E5E5EA", borderWidth: 1, borderRadius: 15, padding: 12, gap: 4 }, answerCard: { width: "100%", backgroundColor: "#F4F7FF", borderColor: "#DCE7FF", borderWidth: 1, borderRadius: 15, padding: 12, gap: 4 }, cardLabel: { color: "#2563EB", fontSize: 10, fontWeight: "800", textAlign: "right" }, transcript: { color: "#4B4B55", fontSize: 13, lineHeight: 19, textAlign: "right" }, answer: { color: "#2D3444", fontSize: 13, lineHeight: 19, textAlign: "right" }, controls: { marginTop: "auto", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 20, paddingTop: 15 }, primaryControl: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "#CFE0FF" }, recordingControl: { backgroundColor: "#D54861", borderColor: "#FFD7DD" }, secondaryControl: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E2E7", alignItems: "center", justifyContent: "center" }, mutedControl: { backgroundColor: "#FFF3E2", borderColor: "#F2DBB7" }, endControl: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFF3F5", borderWidth: 1, borderColor: "#F1D0D6", alignItems: "center", justifyContent: "center" }, hint: { color: "#81818A", fontSize: 11, lineHeight: 17, textAlign: "center", paddingVertical: 14, maxWidth: 340 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] } });
