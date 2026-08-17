import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function ScreenHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <View style={styles.heading}><View style={styles.headingText}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text></View>{action}</View>;
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "primary" }) {
  return <View style={[styles.pill, styles[`pill_${tone}`]]}><Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text></View>;
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionText}>{title}</Text>{detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}</View>;
}

export function IconButton({ icon, label, onPress, active = false, disabled = false }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, disabled && styles.iconButtonDisabled, pressed && styles.pressed]}><IconSymbol name={icon} size={20} color={active ? "#FFFFFF" : "#555562"} /></Pressable>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, headingText: { gap: 4, flexShrink: 1 }, eyebrow: { color: "#73737D", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textAlign: "right" }, title: { color: "#202025", fontSize: 28, fontWeight: "800", letterSpacing: -0.6, textAlign: "right" }, pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, pill_neutral: { backgroundColor: "#F0F0F2" }, pill_success: { backgroundColor: "#E7F6EF" }, pill_warning: { backgroundColor: "#FFF3E2" }, pill_primary: { backgroundColor: "#EAF1FF" }, pillText: { fontSize: 11, fontWeight: "800", textAlign: "center" }, pillText_neutral: { color: "#5F5F69" }, pillText_success: { color: "#16835D" }, pillText_warning: { color: "#A75A08" }, pillText_primary: { color: "#2563EB" }, sectionTitle: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, sectionText: { color: "#2A2A30", fontSize: 16, fontWeight: "800", textAlign: "right" }, sectionDetail: { color: "#85858D", fontSize: 12, fontWeight: "600", textAlign: "left" }, iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7E7EA" }, iconButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" }, iconButtonDisabled: { opacity: 0.45 }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] }
});
