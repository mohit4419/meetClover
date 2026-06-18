/**
 * User detail — quick view + Like / Pass shortcuts + Report.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { NeoButton, NeoCard, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, SHADOW, SPACING } from "@/src/theme";

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [u, setU] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<User>(`/users/${id}`);
        setU(data);
      } catch (e: any) {
        toast.show(e.message || "Not found", "danger");
        router.back();
      }
    })();
  }, [id, router, toast]);

  if (!u) return <View style={styles.center}><ActivityIndicator color={COLORS.pink} size="large" /></View>;

  const swipe = async (action: "like" | "pass" | "super") => {
    setBusy(true);
    try {
      const r = await api<{ match: any }>("/swipe", { method: "POST", body: { target_id: u.id, action } });
      if (r.match) {
        router.replace({ pathname: "/match", params: { matchId: r.match.id, name: u.display_name, photo: u.photos?.[0] || "" } });
      } else {
        toast.show(action === "like" ? "Liked!" : action === "super" ? "Super liked!" : "Passed", "success");
        router.back();
      }
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    try {
      await api("/report", { method: "POST", body: { target_id: u.id, reason: "inappropriate" } });
      toast.show("Reported. Thank you.", "success");
    } catch (e: any) {
      toast.show(e.message, "danger");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="user-detail-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={[styles.card, SHADOW.hardLg]}>
          <Image source={{ uri: u.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600" }} style={styles.photo} />
          <View style={styles.body}>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {u.verified ? <Pill bg={COLORS.blue}><Text style={styles.tinyPill}>✓ VERIFIED</Text></Pill> : null}
              <Pill bg={COLORS.yellow}><Text style={styles.tinyPill}>TRUST {u.trust_score}</Text></Pill>
            </View>
            <Text style={styles.name}>{u.display_name}, {u.age || "?"}</Text>
            <Text style={styles.meta}>{[u.country, u.languages?.join(", ").toUpperCase()].filter(Boolean).join(" · ")}</Text>
            {u.bio ? <Text style={styles.bio}>{u.bio}</Text> : null}
          </View>
        </View>

        <Text style={styles.section}>INTERESTS</Text>
        <NeoCard>
          <View style={styles.wrap}>
            {(u.interests || []).map((i) => (
              <View key={i} style={styles.interestPill}><Text style={styles.interestText}>{i}</Text></View>
            ))}
          </View>
        </NeoCard>

        <View style={styles.actions}>
          <NeoButton testID="ud-pass" label="PASS" variant="secondary" onPress={() => swipe("pass")} disabled={busy} fullWidth />
          <NeoButton testID="ud-super" label="SUPER LIKE" variant="yellow" onPress={() => swipe("super")} disabled={busy} fullWidth />
          <NeoButton testID="ud-like" label="LIKE" onPress={() => swipe("like")} disabled={busy} fullWidth />
        </View>

        <NeoButton testID="ud-report" label="REPORT USER" variant="secondary" onPress={report} style={{ marginTop: SPACING.md }} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  card: { backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.border, borderRadius: 20, overflow: "hidden" },
  photo: { width: "100%", height: 340 },
  body: { padding: SPACING.md, borderTopWidth: 3, borderTopColor: COLORS.border, gap: 6 },
  name: { fontSize: 26, fontWeight: "900", marginTop: 6 },
  meta: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  bio: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary, marginTop: 4 },
  tinyPill: { fontSize: 10, fontWeight: "900" },
  section: { ...FONTS.label, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestPill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.bgSecondary, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999 },
  interestText: { fontSize: 12, fontWeight: "800" },
  actions: { gap: SPACING.sm, marginTop: SPACING.lg },
});
