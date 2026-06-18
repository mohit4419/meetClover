/**
 * Chats tab — list of active matches.
 */

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SPACING } from "@/src/theme";

type Match = {
  id: string;
  other_user: User | null;
  last_message: any;
  last_message_at?: string;
};

export default function Chats() {
  const router = useRouter();
  const toast = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Match[] }>("/matches");
      setMatches(r.items);
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="chats-screen">
      <View style={styles.header}>
        <Text style={styles.title}>CHATS</Text>
        <Text style={styles.sub}>{matches.length} active vibes</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.pink} size="large" /></View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.empty}>No matches yet.</Text>
          <Text style={styles.emptySub}>Start swiping to find your vibe.</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`chat-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.other_user?.display_name || "User", photo: item.other_user?.photos?.[0] || "", lang: item.other_user?.preferred_language || "en" } })}
            >
              <Image source={{ uri: item.other_user?.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200" }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.other_user?.display_name || "Unknown"}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message?.text || "Say hi 👋"}
                </Text>
              </View>
              {item.last_message ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  title: { ...FONTS.h1, color: COLORS.text },
  sub: { ...FONTS.body, color: COLORS.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  empty: { ...FONTS.h3, color: COLORS.text, marginTop: 12 },
  emptySub: { ...FONTS.body, color: COLORS.textSecondary },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.bgSecondary },
  name: { fontWeight: "900", fontSize: 17, color: COLORS.text },
  preview: { fontWeight: "600", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.pink, borderWidth: 2, borderColor: COLORS.border },
  sep: { height: 3, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg, opacity: 0.1 },
});
