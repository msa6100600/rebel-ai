import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useOwnerSession } from "@/lib/owner-session";

export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { isOwnerSession, loading: ownerLoading } = useOwnerSession();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 62 + bottomPadding;

  if (loading || ownerLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.tint} /></View>;
  if (!isAuthenticated && !isOwnerSession) return <Redirect href="/login" />;

  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: colors.muted, tabBarButton: HapticTab, tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 }, tabBarItemStyle: { paddingTop: 2 }, tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, elevation: 0, shadowOpacity: 0 } }}>
    <Tabs.Screen name="index" options={{ title: "المحادثة", tabBarIcon: ({ color }) => <IconSymbol size={23} name="bubble.left.and.bubble.right.fill" color={color} /> }} />
    <Tabs.Screen name="memory" options={{ title: "الذاكرة", tabBarIcon: ({ color }) => <IconSymbol size={22} name="brain.head.profile" color={color} /> }} />
    <Tabs.Screen name="sources" options={{ title: "المصادر", tabBarIcon: ({ color }) => <IconSymbol size={22} name="books.vertical.fill" color={color} /> }} />
    <Tabs.Screen name="approvals" options={{ title: "الموافقات", tabBarIcon: ({ color }) => <IconSymbol size={22} name="checkmark.seal.fill" color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.circle.fill" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color }) => <IconSymbol size={22} name="gearshape.fill" color={color} /> }} />
  </Tabs>;
}
