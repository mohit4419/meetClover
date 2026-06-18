/**
 * Referral — show user's referral code with a Copy button.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { NeoButton, NeoCard } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

export default function Referral() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const code = user?.referral_code || "FLICK01";

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      toast.show("Code copied!", "success");
    } catch {
      toast.show(code, "info");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="referral-screen">
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="ref-back" style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={COLORS.text} /></Pressable>
        <Text style={styles.title}>INVITE</Text>
      </View>

      <Image
        source={{ uri: "https://images.pexels.com/photos/8556342/pexels-photo-8556342.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=600" }}
        style={[styles.hero, SHADOW.hardLg]}
      />

      <Text style={styles.headline}>EARN COINS.{"\n"}INVITE YOUR CREW.</Text>
      <Text style={styles.sub}>Get 500 coins for every friend who joins with your code.</Text>

      <NeoCard style={{ marginTop: SPACING.lg }}>
        <Text style={styles.label}>YOUR CODE</Text>
        <Text testID="referral-code" style={styles.code}>{code}</Text>
        <NeoButton testID="referral-copy-btn" label="COPY CODE" onPress={copy} style={{ marginTop: SPACING.md }} fullWidth />
      </NeoCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white },
  title: { ...FONTS.h2, color: COLORS.text },
  hero: { width: "100%", height: 200, borderRadius: RADIUS.lg, borderWidth: 3, borderColor: COLORS.border, marginTop: SPACING.md },
  headline: { ...FONTS.h1, fontSize: 36, lineHeight: 38, color: COLORS.text, marginTop: SPACING.lg },
  sub: { ...FONTS.body, color: COLORS.textSecondary, marginTop: 6 },
  label: { ...FONTS.label, color: COLORS.text },
  code: { fontSize: 44, fontWeight: "900", color: COLORS.text, letterSpacing: 4, marginTop: 4 },
});
