import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ActivityIndicator, Platform, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useOwnerSession } from "@/lib/owner-session";

export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { isOwnerSession, loading: ownerLoading } = useOwnerSession();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  if (loading || ownerLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.tint} /></View>;
  if (!isAuthenticated && !isOwnerSession) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "المحادثة",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="memory" options={{ title: "الذاكرة", tabBarIcon: ({ color }) => <IconSymbol size={24} name="brain.head.profile" color={color} /> }} />
      <Tabs.Screen name="sources" options={{ title: "المصادر", tabBarIcon: ({ color }) => <IconSymbol size={24} name="books.vertical.fill" color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: "الموافقات", tabBarIcon: ({ color }) => <IconSymbol size={24} name="checkmark.seal.fill" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.circle.fill" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} /> }} />
    </Tabs>
  );
}
