/**
 * Profile tab — view + quick stats + entry points (wallet/subscription/referral/admin/logout).
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { NeoButton, NeoCard, Pill } from "@/src/components/ui";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const tierLabel: Record<string, string> = { free: "FREE", premium: "PREMIUM", premium_plus: "PREMIUM+" };
  const tierColor = user.subscription_tier === "free" ? COLORS.white : COLORS.yellow;

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>ME</Text>
          <Pressable testID="edit-profile-btn" onPress={() => router.push("/onboarding")} style={[styles.editBtn, SHADOW.hard]}>
            <Ionicons name="pencil" size={14} color={COLORS.text} />
            <Text style={styles.editText}>EDIT</Text>
          </Pressable>
        </View>

        <View style={[styles.heroCard, SHADOW.hardLg]}>
          <Image source={{ uri: user.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600" }} style={styles.hero} />
          <View style={styles.heroBody}>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Pill bg={tierColor}><Text style={styles.tinyPill}>{tierLabel[user.subscription_tier]}</Text></Pill>
              <Pill bg={COLORS.yellow}><Text style={styles.tinyPill}>TRUST {user.trust_score}</Text></Pill>
              {user.verified ? <Pill bg={COLORS.blue}><Text style={styles.tinyPill}>✓ VERIFIED</Text></Pill> : null}
            </View>
            <Text style={styles.name}>{user.display_name}{user.age ? `, ${user.age}` : ""}</Text>
            <Text style={styles.meta}>{[user.country, user.languages?.join(", ").toUpperCase()].filter(Boolean).join(" · ")}</Text>
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat bg={COLORS.pink} label="COINS" value={String(user.coins)} testID="stat-coins" />
          <Stat bg={COLORS.yellow} label="INTERESTS" value={String(user.interests?.length || 0)} />
          <Stat bg={COLORS.blue} label="LANGS" value={String(user.languages?.length || 0)} />
        </View>

        <Text style={styles.section}>MY VIBE</Text>
        <NeoCard>
          <View style={styles.wrap}>
            {(user.interests || []).map((i) => (
              <View key={i} style={styles.interestPill}><Text style={styles.interestText}>{i}</Text></View>
            ))}
            {(user.interests?.length || 0) === 0 ? <Text style={{ color: COLORS.textSecondary, fontWeight: "700" }}>Add interests in Edit.</Text> : null}
          </View>
        </NeoCard>

        <Text style={styles.section}>MORE</Text>
        <View style={{ gap: SPACING.sm }}>
          <Row testID="row-photos" icon="images" label="MANAGE PHOTOS" bg={COLORS.bgSecondary} onPress={() => router.push("/profile-photos")} />
          <Row testID="row-subscription" icon="diamond" label="SUBSCRIPTION" bg={COLORS.yellow} onPress={() => router.push("/subscription")} />
          <Row testID="row-wallet" icon="wallet" label="WALLET & GIFTS" bg={COLORS.pink} onPress={() => router.push("/wallet")} />
          <Row testID="row-referral" icon="gift" label="REFER FRIENDS" bg={COLORS.blue} onPress={() => router.push("/referral")} />
          {user.is_admin ? <Row testID="row-admin" icon="shield" label="ADMIN DASHBOARD" bg={COLORS.danger} onPress={() => router.push("/admin")} /> : null}
        </View>

        <NeoButton testID="logout-btn" label="LOG OUT" variant="secondary" style={{ marginTop: SPACING.xl, marginBottom: SPACING.xl }} onPress={logout} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ bg, label, value, testID }: { bg: string; label: string; value: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.stat, SHADOW.hard, { backgroundColor: bg }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, bg, onPress, testID }: { icon: any; label: string; bg: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.row, SHADOW.hard]}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={COLORS.text} /></View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  title: { ...FONTS.h1, color: COLORS.text },
  editBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  editText: { fontWeight: "900", fontSize: 12 },
  heroCard: { backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: "hidden" },
  hero: { width: "100%", height: 280 },
  heroBody: { padding: SPACING.md, borderTopWidth: 3, borderTopColor: COLORS.border, gap: 6 },
  name: { fontSize: 26, fontWeight: "900", color: COLORS.text, marginTop: 6 },
  meta: { fontWeight: "800", fontSize: 12, color: COLORS.text, letterSpacing: 1 },
  bio: { fontWeight: "600", color: COLORS.textSecondary, marginTop: 4 },
  tinyPill: { fontSize: 10, fontWeight: "900", color: COLORS.text },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  stat: { flex: 1, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center" },
  statValue: { fontSize: 26, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 11, fontWeight: "800", color: COLORS.text, letterSpacing: 0.8, marginTop: 2 },
  section: { ...FONTS.label, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  interestPill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.bgSecondary, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999 },
  interestText: { fontSize: 12, fontWeight: "800", color: COLORS.text },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md },
  rowIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5 },
});
