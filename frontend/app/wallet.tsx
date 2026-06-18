/**
 * Wallet — coin packs (mock purchase).
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

const PACKS = [
  { id: "small", coins: 100, price: "$0.99", color: COLORS.bgSecondary },
  { id: "medium", coins: 500, price: "$3.99", color: COLORS.blue },
  { id: "large", coins: 1200, price: "$7.99", color: COLORS.pink },
  { id: "mega", coins: 3000, price: "$14.99", color: COLORS.yellow },
];

const GIFTS = [
  { name: "Rose", coins: 10, icon: "rose" },
  { name: "Star", coins: 25, icon: "star" },
  { name: "Crown", coins: 100, icon: "trophy" },
  { name: "Boost", coins: 200, icon: "flash" },
];

export default function Wallet() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (pack: string) => {
    setBusy(pack);
    try {
      const u = await api<User>(`/wallet/buy/${pack}`, { method: "POST" });
      updateUser(u);
      toast.show("Purchase successful (demo)", "success");
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="wallet-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="wallet-back" style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={COLORS.text} /></Pressable>
          <Text style={styles.title}>WALLET</Text>
        </View>

        <View style={[styles.balance, SHADOW.hardLg]}>
          <Text style={styles.balLabel}>YOUR COINS</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
            <View style={styles.coinIcon}><Text style={styles.coinIconText}>¢</Text></View>
            <Text testID="wallet-balance" style={styles.balValue}>{user?.coins ?? 0}</Text>
          </View>
        </View>

        <Text style={styles.section}>COIN PACKS</Text>
        <View style={styles.grid}>
          {PACKS.map((p) => (
            <Pressable key={p.id} testID={`pack-${p.id}`} onPress={() => buy(p.id)} disabled={!!busy} style={[styles.pack, SHADOW.hard, { backgroundColor: p.color }]}>
              <View style={[styles.coinIcon, { width: 48, height: 48 }]}><Text style={[styles.coinIconText, { fontSize: 22 }]}>¢</Text></View>
              <Text style={styles.packCoins}>{p.coins.toLocaleString()}</Text>
              <Pill bg={COLORS.white}><Text style={styles.packPrice}>{busy === p.id ? "…" : p.price}</Text></Pill>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>GIFTS</Text>
        <View style={styles.grid}>
          {GIFTS.map((g) => (
            <View key={g.name} style={[styles.pack, SHADOW.hard, { backgroundColor: COLORS.white }]}>
              <View style={[styles.coinIcon, { width: 48, height: 48, backgroundColor: COLORS.pink }]}>
                <Ionicons name={g.icon as any} size={22} color={COLORS.text} />
              </View>
              <Text style={styles.packCoins}>{g.name}</Text>
              <Pill bg={COLORS.yellow}><Text style={styles.packPrice}>¢ {g.coins}</Text></Pill>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white },
  title: { ...FONTS.h2, color: COLORS.text },
  balance: { backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg },
  balLabel: { ...FONTS.label, color: COLORS.text },
  balValue: { fontSize: 48, fontWeight: "900", color: COLORS.text },
  coinIcon: { width: 28, height: 28, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  coinIconText: { fontWeight: "900", color: COLORS.text },
  section: { ...FONTS.label, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  pack: { width: "47%", borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center", gap: 8 },
  packCoins: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  packPrice: { fontWeight: "900", fontSize: 12, color: COLORS.text },
});
