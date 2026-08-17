import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function ScreenHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <View style={styles.heading}>
      <View style={styles.headingText}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "primary" }) {
  return <View style={[styles.pill, styles[`pill_${tone}`]]}><Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text></View>;
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function IconButton({ icon, label, onPress, active = false, disabled = false }: { icon: Parameters<typeof IconSymbol>[0]["name"]; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, disabled && styles.iconButtonDisabled, pressed && styles.pressed]}
    >
      <IconSymbol name={icon} size={20} color={active ? "#FFFFFF" : "#AEB7D6"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headingText: { gap: 3, flexShrink: 1 },
  eyebrow: { color: "#44D7FF", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textAlign: "right" },
  title: { color: "#F5F7FF", fontSize: 30, fontWeight: "800", letterSpacing: -0.5, textAlign: "right" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  pill_neutral: { backgroundColor: "#202A48" },
  pill_success: { backgroundColor: "#123C38" },
  pill_warning: { backgroundColor: "#4C3512" },
  pill_primary: { backgroundColor: "#332A73" },
  pillText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  pillText_neutral: { color: "#C3CAE4" },
  pillText_success: { color: "#57E4AC" },
  pillText_warning: { color: "#F8C26C" },
  pillText_primary: { color: "#D9D2FF" },
  sectionTitle: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionText: { color: "#F5F7FF", fontSize: 16, fontWeight: "800", textAlign: "right" },
  sectionDetail: { color: "#AEB7D6", fontSize: 12, fontWeight: "700", textAlign: "left" },
  iconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#1C2644", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2C3A62" },
  iconButtonActive: { backgroundColor: "#7C5CFC", borderColor: "#9B89FF" },
  iconButtonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
