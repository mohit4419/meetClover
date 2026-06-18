/**
 * Subscription — 3-tier upsell with mock upgrade.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { NeoButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

const PLANS = [
  {
    id: "free", name: "FREE", price: "$0", color: COLORS.white,
    features: ["10 swipes / day", "Local matches only", "Basic chat", "Ads"],
  },
  {
    id: "premium", name: "PREMIUM", price: "$9.99/mo", color: COLORS.pink,
    features: ["Unlimited swipes", "Country + gender filters", "AI translation", "No ads"],
  },
  {
    id: "premium_plus", name: "PREMIUM+", price: "$19.99/mo", color: COLORS.yellow, popular: true,
    features: ["Everything in Premium", "Priority matching", "Advanced discovery", "Verified badge", "Exclusive themes"],
  },
];

export default function Subscription() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string>(user?.subscription_tier || "premium");
  const [busy, setBusy] = useState(false);

  const subscribe = async (plan: string) => {
    setBusy(true);
    try {
      const u = await api<User>("/subscription", { method: "POST", body: { plan } });
      updateUser(u);
      toast.show(plan === "free" ? "Downgraded to Free" : `Welcome to ${plan.replace("_", " ").toUpperCase()}!`, "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="subscription-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} testID="sub-close-btn">
          <Ionicons name="close" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>UNLOCK{"\n"}EVERYTHING.</Text>
        <Text style={styles.sub}>Cancel anytime. Demo — no charge.</Text>

        <View style={{ gap: SPACING.md, marginTop: SPACING.xl }}>
          {PLANS.map((p) => {
            const active = selected === p.id;
            return (
              <Pressable
                key={p.id}
                testID={`plan-${p.id}`}
                onPress={() => setSelected(p.id)}
                style={[styles.plan, SHADOW.hardLg, { backgroundColor: p.color }, active && { transform: [{ scale: 1.02 }] }]}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{p.name}</Text>
                  {p.popular ? <View style={styles.popular}><Text style={styles.popularText}>POPULAR</Text></View> : null}
                </View>
                <Text style={styles.planPrice}>{p.price}</Text>
                <View style={{ gap: 6, marginTop: SPACING.sm }}>
                  {p.features.map((f) => (
                    <View key={f} style={styles.feature}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.text} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                {active ? <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>SELECTED</Text></View> : null}
              </Pressable>
            );
          })}
        </View>

        <NeoButton
          testID="sub-confirm-btn"
          label={busy ? "PROCESSING…" : `GET ${selected.replace("_", " ").toUpperCase()}`}
          onPress={() => subscribe(selected)}
          disabled={busy}
          style={{ marginTop: SPACING.xl }}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  closeBtn: { alignSelf: "flex-end", padding: 8, borderWidth: 2, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: SPACING.md },
  title: { ...FONTS.h1, color: COLORS.text },
  sub: { ...FONTS.bodyLg, color: COLORS.textSecondary, marginTop: 4 },
  plan: { borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  popular: { backgroundColor: COLORS.text, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  popularText: { color: COLORS.white, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  planPrice: { fontSize: 30, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  feature: { flexDirection: "row", gap: 8, alignItems: "center" },
  featureText: { fontWeight: "700", color: COLORS.text, fontSize: 14 },
  activeBadge: { position: "absolute", top: -10, right: 16, backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activeBadgeText: { color: COLORS.white, fontWeight: "900", fontSize: 10 },
});
