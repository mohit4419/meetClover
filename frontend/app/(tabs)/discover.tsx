/**
 * Discover — grid with sticky horizontal chip filters.
 */

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { Chip, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, COUNTRIES, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

const GENDER_FILTERS = ["all", "female", "male", "other"];

export default function Discover() {
  const router = useRouter();
  const toast = useToast();
  const [gender, setGender] = useState("all");
  const [country, setCountry] = useState<string>("all");
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (gender !== "all") params.set("gender", gender);
      if (country !== "all") params.set("country", country);
      const qs = params.toString();
      const r = await api<{ items: User[] }>(`/discover${qs ? `?${qs}` : ""}`);
      setItems(r.items);
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setLoading(false);
    }
  }, [gender, country, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="discover-screen">
      <View style={styles.header}>
        <Text style={styles.title}>DISCOVER</Text>
        <Text style={styles.sub}>{items.length} people near your vibe</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {GENDER_FILTERS.map((g) => (
          <Chip key={g} testID={`discover-gender-${g}`} label={g.toUpperCase()} active={gender === g} onPress={() => setGender(g)} />
        ))}
        <View style={styles.divider} />
        <Chip testID="discover-country-all" label="ALL" active={country === "all"} onPress={() => setCountry("all")} />
        {COUNTRIES.map((c) => (
          <Chip key={c} testID={`discover-country-${c}`} label={c} active={country === c} onPress={() => setCountry(c)} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.pink} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={styles.empty}>No matches for these filters.</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: SPACING.md, marginBottom: SPACING.md }}
          renderItem={({ item }) => (
            <Pressable testID={`discover-card-${item.id}`} style={[styles.gridCard, SHADOW.hard]} onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } })}>
              <Image source={{ uri: item.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" }} style={styles.gridPhoto} />
              <View style={styles.gridBody}>
                <Text style={styles.gridName} numberOfLines={1}>{item.display_name}, {item.age || "?"}</Text>
                <Text style={styles.gridMeta} numberOfLines={1}>{item.country || "Unknown"}</Text>
                <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                  {item.verified ? <Pill bg={COLORS.blue}><Text style={styles.tinyPill}>✓</Text></Pill> : null}
                  <Pill bg={COLORS.yellow}><Text style={styles.tinyPill}>{item.trust_score}</Text></Pill>
                </View>
              </View>
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
  divider: { width: 2, height: 24, backgroundColor: COLORS.border, marginHorizontal: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { ...FONTS.bodyLg, color: COLORS.textSecondary },
  grid: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  gridCard: { flex: 1, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: "hidden" },
  gridPhoto: { width: "100%", height: 180 },
  gridBody: { padding: 10, borderTopWidth: 3, borderTopColor: COLORS.border },
  gridName: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  gridMeta: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  tinyPill: { fontSize: 10, fontWeight: "900" },
});
