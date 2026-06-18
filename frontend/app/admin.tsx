/**
 * Admin-lite dashboard with global stats.
 */

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Stats = { users: number; matches: number; messages: number; reports: number; premium_users: number };

export default function Admin() {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await api<Stats>("/admin/stats")); }
    catch (e: any) { toast.show(e.message, "danger"); router.back(); }
    finally { setLoading(false); }
  }, [router, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="admin-screen">
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="adm-back" style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>ADMIN</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingTop: 0 }}>
        {loading || !s ? <ActivityIndicator color={COLORS.pink} /> : (
          <View style={styles.grid}>
            <Stat bg={COLORS.pink} label="USERS" value={s.users} />
            <Stat bg={COLORS.yellow} label="MATCHES" value={s.matches} />
            <Stat bg={COLORS.blue} label="MESSAGES" value={s.messages} />
            <Stat bg={COLORS.danger} label="REPORTS" value={s.reports} fg={COLORS.white} />
            <Stat bg={COLORS.bgSecondary} label="PREMIUM" value={s.premium_users} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ bg, label, value, fg = COLORS.text }: { bg: string; label: string; value: number; fg?: string }) {
  return (
    <View style={[styles.stat, SHADOW.hard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color: fg }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white },
  title: { ...FONTS.h1, color: COLORS.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  stat: { width: "47%", aspectRatio: 1, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, justifyContent: "space-between" },
  statValue: { fontSize: 40, fontWeight: "900" },
  statLabel: { ...FONTS.label },
});
