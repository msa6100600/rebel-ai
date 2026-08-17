import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { haptic } from "@/lib/haptics";
import { voiceProfiles, useRebelStore } from "@/lib/rebel-store";
import { trpc } from "@/lib/trpc";

const getMimeType = () => Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";

export default function CallScreen() {
  const router = useRouter();
  const { preferences, memories, addMessage, addApproval } = useRebelStore();
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

  const handleVoiceTurn = async () => {
    if (muted || status === "thinking" || status === "speaking") return;
    if (Platform.OS === "web") {
      Alert.alert("Rebal Live", "التسجيل يعمل من تطبيق Android بعد تثبيته. استخدم نسخة الهاتف لاختبار المحادثة الصوتية.");
      return;
    }
    try {
      if (!recorderState.isRecording) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setLastHeard("يلزم السماح بالميكروفون لبدء Rebal Live.");
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setStatus("listening");
        setLastHeard("جاري الاستماع… اضغط مرة أخرى لإرسال ما قلته.");
        haptic.medium();
        return;
      }
      await recorder.stop();
      const audioUri = recorder.uri;
      if (!audioUri) throw new Error("missing audio");
      setStatus("thinking");
      const transcriptionResult = await transcription.mutateAsync({ audioBase64: await new File(audioUri).base64(), mimeType: getMimeType(), language: selectedVoice.language });
      if (!transcriptionResult.ok || !transcriptionResult.text) throw new Error("empty transcription");
      setLastHeard(transcriptionResult.text);
      addMessage({ role: "user", text: transcriptionResult.text });
      const result = await chat.mutateAsync({ message: transcriptionResult.text, memories: memories.slice(0, 8).map(({ title, content, category }) => ({ title, content, category })), language: selectedVoice.language, model: preferences.selectedModel as "gpt-5" | "gpt-5-mini" | "claude-sonnet-4-6" | "gemini-3.1-pro-preview" });
      addMessage({ role: "assistant", text: result.answer, insight: result.insight, confidence: result.confidence });
      if (result.suggestedMemory && preferences.allowSuggestedLearning) addApproval({ title: `حفظ معرفة مقترحة: ${result.suggestedMemory.title}`, detail: result.suggestedMemory.content, type: "تعلم مقترح", memory: result.suggestedMemory });
      setLastAnswer(result.answer);
      haptic.success();
      await speakAnswer(result.answer);
    } catch {
      setStatus("ready");
      setLastAnswer("تعذر إتمام هذه الجولة الصوتية. تحقق من اتصال الإنترنت وجرّب مرة أخرى.");
      haptic.warning();
    }
  };

  const toggleMute = async () => {
    if (recorderState.isRecording) await recorder.stop().catch(() => undefined);
    setMuted((value) => !value);
    setStatus("ready");
    haptic.medium();
  };
  const endCall = async () => {
    if (recorderState.isRecording) await recorder.stop().catch(() => undefined);
    await Speech.stop();
    setStatus("ended");
    haptic.medium();
    setTimeout(() => router.back(), 250);
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background" safeAreaClassName="bg-background"><View style={styles.page}>
    <Text style={styles.eyebrow}>REBAL LIVE · VOICE MODE</Text><Text style={styles.timer}>{time}</Text><Text style={styles.status}>{statusText}</Text>
    <View style={[styles.orb, status === "listening" && styles.orbListening, status === "speaking" && styles.orbSpeaking]}><View style={styles.orbInner}><IconSymbol name="brain.head.profile" size={70} color="#F0EEFF" /></View></View>
    <View style={styles.identity}><Text style={styles.identityName}>{selectedVoice.name}</Text><Text style={styles.identityDetail}>{selectedVoice.dialect} · {selectedVoice.language}</Text></View>
    <View style={styles.transcriptCard}><Text style={styles.cardLabel}>أنت قلت</Text><Text style={styles.transcript}>{lastHeard}</Text></View><View style={styles.answerCard}><Text style={styles.cardLabel}>رد Rebel AI</Text><Text style={styles.answer}>{lastAnswer}</Text></View>
    <View style={styles.controls}><Pressable accessibilityRole="button" accessibilityLabel={muted ? "إلغاء كتم الميكروفون" : "كتم الميكروفون"} onPress={toggleMute} style={({ pressed }) => [styles.secondaryControl, muted && styles.mutedControl, pressed && styles.pressed]}><IconSymbol name={muted ? "mic.slash.fill" : "mic.fill"} size={25} color="#FFFFFF" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? "إيقاف وإرسال كلامك" : "بدء التحدث مع Rebal Live"} disabled={status === "thinking" || status === "speaking" || muted} onPress={handleVoiceTurn} style={({ pressed }) => [styles.primaryControl, recorderState.isRecording && styles.recordingControl, muted && styles.disabled, pressed && styles.pressed]}>{status === "thinking" ? <ActivityIndicator color="#FFFFFF" /> : <IconSymbol name="mic.fill" size={32} color="#FFFFFF" />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="إنهاء Rebal Live" onPress={endCall} style={({ pressed }) => [styles.endControl, pressed && styles.pressed]}><IconSymbol name="xmark" size={25} color="#FFFFFF" /></Pressable></View><Text style={styles.hint}>{recorderState.isRecording ? "اضغط الميكروفون مرة أخرى عند نهاية دورك." : muted ? "الميكروفون مكتوم." : "تحدث في دورك، ثم سيحلل Rebel AI رسالتك ويرد بصوت قبل الجولة التالية."}</Text>
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({ page: { flex: 1, alignItems: "center", paddingTop: 22, gap: 10 }, eyebrow: { color: "#63DDF8", fontWeight: "900", letterSpacing: 1.4, fontSize: 11 }, timer: { color: "#F5F7FF", fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums"] }, status: { color: "#B5C4EA", fontSize: 14, fontWeight: "700" }, orb: { width: 176, height: 176, borderRadius: 88, justifyContent: "center", alignItems: "center", marginVertical: 8, backgroundColor: "#3E3190", borderWidth: 10, borderColor: "#30276B", shadowColor: "#725BFF", shadowOpacity: 0.6, shadowRadius: 28, elevation: 10 }, orbListening: { backgroundColor: "#16777A", borderColor: "#135C68" }, orbSpeaking: { backgroundColor: "#5243B4", borderColor: "#42358D" }, orbInner: { width: 112, height: 112, borderRadius: 56, backgroundColor: "#24204E", alignItems: "center", justifyContent: "center" }, identity: { alignItems: "center", gap: 3, marginBottom: 4 }, identityName: { color: "#F5F7FF", fontSize: 19, fontWeight: "900" }, identityDetail: { color: "#97A9D5", fontSize: 12 }, transcriptCard: { width: "100%", backgroundColor: "#15233D", borderColor: "#2F4C7A", borderWidth: 1, borderRadius: 15, padding: 12, gap: 4 }, answerCard: { width: "100%", backgroundColor: "#141D36", borderColor: "#33476E", borderWidth: 1, borderRadius: 15, padding: 12, gap: 4 }, cardLabel: { color: "#6DE5FF", fontSize: 10, fontWeight: "900", textAlign: "right" }, transcript: { color: "#D8E6FF", fontSize: 13, lineHeight: 19, textAlign: "right" }, answer: { color: "#F4F6FF", fontSize: 13, lineHeight: 19, textAlign: "right" }, controls: { marginTop: "auto", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 20, paddingTop: 15 }, primaryControl: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#7259F4", alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "#B2A5FF" }, recordingControl: { backgroundColor: "#D54861", borderColor: "#FFB4C0" }, secondaryControl: { width: 57, height: 57, borderRadius: 28.5, backgroundColor: "#263755", alignItems: "center", justifyContent: "center" }, mutedControl: { backgroundColor: "#7A5841" }, endControl: { width: 57, height: 57, borderRadius: 28.5, backgroundColor: "#C93E55", alignItems: "center", justifyContent: "center" }, hint: { color: "#8C9BC1", fontSize: 11, lineHeight: 17, textAlign: "center", paddingVertical: 14, maxWidth: 340 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] } });
