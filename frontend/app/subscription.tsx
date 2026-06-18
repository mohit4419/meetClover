/**
 * Subscription — 3-tier upsell. Real Stripe checkout for paid plans, mock for free.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
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

function currentOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return process.env.EXPO_PUBLIC_BACKEND_URL || "";
}

export default function Subscription() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string>(user?.subscription_tier || "premium");
  const [busy, setBusy] = useState(false);

  const proceed = async () => {
    setBusy(true);
    try {
      if (selected === "free") {
        const u = await api<User>("/subscription", { method: "POST", body: { plan: "free" } });
        updateUser(u);
        toast.show("Downgraded to Free", "info");
        router.back();
        return;
      }
      const origin = currentOrigin();
      const r = await api<{ url: string; session_id: string }>("/payments/checkout", {
        method: "POST",
        body: { plan: selected, origin },
      });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = r.url;
      } else {
        await WebBrowser.openBrowserAsync(r.url);
        // After in-app browser closes, send user to status check
        router.replace({ pathname: "/payment/return", params: { session_id: r.session_id } });
      }
    } catch (e: any) {
      toast.show(e.message || "Checkout failed", "danger");
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
        <Text style={styles.sub}>Stripe TEST mode — card 4242 4242 4242 4242 any future date + any CVC.</Text>

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
          label={busy ? "PROCESSING…" : selected === "free" ? "SET TO FREE" : `CHECKOUT WITH STRIPE`}
          onPress={proceed}
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
  sub: { ...FONTS.body, color: COLORS.textSecondary, marginTop: 4 },
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
