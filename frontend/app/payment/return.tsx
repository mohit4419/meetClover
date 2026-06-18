/**
 * Stripe redirect landing page — polls payment status, upgrades tier on success.
 */

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { NeoButton, NeoCard } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, SHADOW, SPACING } from "@/src/theme";

type Phase = "checking" | "paid" | "expired" | "error";

export default function PaymentReturn() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("checking");
  const [info, setInfo] = useState<{ plan?: string; amount?: number } | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!session_id) { setPhase("error"); return; }
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      tries.current += 1;
      try {
        const r = await api<{ payment_status: string; status: string; plan: string; amount: number }>(`/payments/status/${session_id}`);
        setInfo({ plan: r.plan, amount: r.amount });
        if (r.payment_status === "paid") {
          setPhase("paid");
          await refresh();
          toast.show(`Welcome to ${r.plan.replace("_", " ").toUpperCase()}!`, "success");
          return;
        }
        if (r.status === "expired") { setPhase("expired"); return; }
        if (tries.current >= 10) { setPhase("expired"); return; }
        setTimeout(poll, 2000);
      } catch (e: any) {
        toast.show(e.message || "Status check failed", "danger");
        setPhase("error");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [session_id, refresh, toast]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="payment-return-screen">
      <View style={styles.content}>
        {phase === "checking" ? (
          <>
            <ActivityIndicator color={COLORS.pink} size="large" />
            <Text style={styles.title}>Confirming your payment…</Text>
            <Text style={styles.sub}>Hang tight, Stripe is finishing up.</Text>
          </>
        ) : phase === "paid" ? (
          <>
            <View style={[styles.badge, SHADOW.hard, { backgroundColor: COLORS.success }]}>
              <Ionicons name="checkmark" size={48} color={COLORS.white} />
            </View>
            <Text style={styles.title}>YOU&apos;RE IN.</Text>
            <Text style={styles.sub}>{info?.plan?.replace("_", " ").toUpperCase()} is now active.</Text>
            <NeoButton testID="pay-return-continue" label="LET&apos;S GO" onPress={() => router.replace("/(tabs)/swipe")} style={{ marginTop: SPACING.xl }} fullWidth />
          </>
        ) : (
          <>
            <View style={[styles.badge, SHADOW.hard, { backgroundColor: COLORS.danger }]}>
              <Ionicons name="close" size={48} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Payment not completed.</Text>
            <Text style={styles.sub}>No charge was made. You can try again any time.</Text>
            <NeoButton testID="pay-return-retry" label="BACK TO PLANS" variant="yellow" onPress={() => router.replace("/subscription")} style={{ marginTop: SPACING.xl }} fullWidth />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, padding: SPACING.lg, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  badge: { width: 92, height: 92, borderRadius: 999, borderWidth: 3, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  title: { ...FONTS.h1, color: COLORS.text, textAlign: "center" },
  sub: { ...FONTS.bodyLg, color: COLORS.textSecondary, textAlign: "center" },
});
