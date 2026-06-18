/**
 * Chats tab — list of active matches with filter chips + unread badges.
 */

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { Chip } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Match = {
  id: string;
  other_user: User | null;
  last_message: any;
  last_message_at?: string;
  unread: number;
};

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "unread", label: "UNREAD" },
  { id: "verified", label: "VERIFIED" },
  { id: "new", label: "NEW MATCH" },
];

export default function Chats() {
  const router = useRouter();
  const toast = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

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

  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "unread") return (m.unread || 0) > 0;
      if (filter === "verified") return !!m.other_user?.verified;
      if (filter === "new") return !m.last_message;
      return true;
    });
  }, [matches, filter]);

  const totalUnread = matches.reduce((a, m) => a + (m.unread || 0), 0);

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="chats-screen">
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.title}>CHATS</Text>
          {totalUnread > 0 ? (
            <View testID="chats-total-unread" style={styles.unreadHeaderPill}>
              <Text style={styles.unreadHeaderText}>{totalUnread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>{visible.length} {filter === "all" ? "active vibes" : `in "${filter}"`}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTERS.map((f) => (
          <Chip key={f.id} testID={`chats-filter-${f.id}`} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.pink} size="large" /></View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.empty}>No matches in this filter.</Text>
          <Text style={styles.emptySub}>Start swiping to find your vibe.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`chat-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.other_user?.display_name || "User", photo: item.other_user?.photos?.[0] || "", lang: item.other_user?.preferred_language || "en" } })}
            >
              <View>
                <Image source={{ uri: item.other_user?.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200" }} style={styles.avatar} />
                {item.other_user?.verified ? (
                  <View style={styles.verifiedDot}><Ionicons name="checkmark" size={10} color={COLORS.text} /></View>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.name}>{item.other_user?.display_name || "Unknown"}</Text>
                  {!item.last_message ? (
                    <View style={styles.newPill}><Text style={styles.newPillText}>NEW MATCH</Text></View>
                  ) : null}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message?.type === "image" ? "📷 Photo" :
                   item.last_message?.type === "voice" ? "🎙 Voice note" :
                   item.last_message?.text || "Say hi 👋"}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View testID={`chat-unread-${item.id}`} style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread > 9 ? "9+" : item.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  title: { ...FONTS.h1, color: COLORS.text },
  sub: { ...FONTS.body, color: COLORS.textSecondary, marginTop: 2 },
  chipRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  empty: { ...FONTS.h3, color: COLORS.text, marginTop: 12 },
  emptySub: { ...FONTS.body, color: COLORS.textSecondary },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.bgSecondary },
  verifiedDot: { position: "absolute", right: -4, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.blue, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  name: { fontWeight: "900", fontSize: 17, color: COLORS.text },
  preview: { fontWeight: "600", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: COLORS.pink, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", ...SHADOW.hard },
  badgeText: { fontWeight: "900", fontSize: 12, color: COLORS.text },
  unreadHeaderPill: { backgroundColor: COLORS.pink, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  unreadHeaderText: { fontWeight: "900", fontSize: 12, color: COLORS.text },
  newPill: { backgroundColor: COLORS.yellow, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  newPillText: { fontWeight: "900", fontSize: 9, color: COLORS.text, letterSpacing: 0.5 },
  sep: { height: 3, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg, opacity: 0.1 },
});
