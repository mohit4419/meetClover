import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopWidth: 3,
          borderTopColor: COLORS.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + (Platform.OS === "ios" ? 0 : 6),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontWeight: "800", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen
        name="swipe"
        options={{
          title: "Swipe",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} bg={COLORS.pink}>
              <Ionicons name="flame" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} bg={COLORS.yellow}>
              <Ionicons name="compass" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="video"
        options={{
          title: "Live",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} bg={COLORS.danger}>
              <Ionicons name="videocam" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} bg={COLORS.blue}>
              <Ionicons name="chatbubble" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} bg={COLORS.bgSecondary}>
              <Ionicons name="person" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ children, focused, bg }: { children: React.ReactNode; focused: boolean; bg: string }) {
  return (
    <View style={[styles.icon, focused && { backgroundColor: bg, borderColor: COLORS.border, borderWidth: 2 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
