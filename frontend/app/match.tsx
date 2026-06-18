/**
 * Match modal screen — celebration after a mutual like.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NeoButton } from "@/src/components/ui";
import { COLORS, FONTS, SHADOW, SPACING } from "@/src/theme";

export default function Match() {
  const { matchId, name, photo } = useLocalSearchParams<{ matchId: string; name: string; photo: string }>();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="match-screen">
      <View style={styles.confetti1} />
      <View style={styles.confetti2} />
      <View style={styles.confetti3} />

      <View style={{ alignItems: "center" }}>
        <Text style={styles.title}>IT&apos;S A{"\n"}VIBE!</Text>
        <Text style={styles.sub}>You and {name} liked each other.</Text>
      </View>

      <View style={styles.avatars}>
        <View style={[styles.avatarWrap, SHADOW.hardLg, { transform: [{ rotate: "-8deg" }], marginRight: -24 }]}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" }} style={styles.avatar} />
        </View>
        <View style={[styles.avatarWrap, SHADOW.hardLg, { transform: [{ rotate: "8deg" }], marginLeft: -24 }]}>
          <Image source={{ uri: photo || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400" }} style={styles.avatar} />
        </View>
      </View>

      <View style={{ gap: SPACING.md, width: "100%" }}>
        <NeoButton testID="match-message-btn" label="SEND A MESSAGE" variant="yellow" onPress={() => router.replace({ pathname: "/chat/[id]", params: { id: matchId as string, name: name as string, photo: photo as string } })} fullWidth />
        <NeoButton testID="match-keep-swiping-btn" label="KEEP SWIPING" variant="secondary" onPress={() => router.back()} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.pink, padding: SPACING.lg, justifyContent: "space-between", alignItems: "center" },
  title: { ...FONTS.h1, fontSize: 64, lineHeight: 62, color: COLORS.text, textAlign: "center", fontWeight: "900" },
  sub: { ...FONTS.bodyLg, color: COLORS.text, marginTop: SPACING.md, textAlign: "center" },
  avatars: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: SPACING.xl },
  avatarWrap: { borderWidth: 3, borderColor: COLORS.border, borderRadius: 999, padding: 4, backgroundColor: COLORS.white },
  avatar: { width: 140, height: 140, borderRadius: 999 },
  confetti1: { position: "absolute", top: 60, left: 20, width: 30, height: 30, backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.border, transform: [{ rotate: "20deg" }] },
  confetti2: { position: "absolute", top: 120, right: 30, width: 24, height: 24, backgroundColor: COLORS.blue, borderWidth: 3, borderColor: COLORS.border, borderRadius: 999 },
  confetti3: { position: "absolute", bottom: 200, left: 40, width: 30, height: 30, backgroundColor: COLORS.bgSecondary, borderWidth: 3, borderColor: COLORS.border, transform: [{ rotate: "-15deg" }] },
});
