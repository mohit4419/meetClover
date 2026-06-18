/**
 * Landing — bold neo-brutalist welcome with two CTAs.
 */

import { useRouter } from "expo-router";
import { StyleSheet, Text, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NeoButton, Pill } from "@/src/components/ui";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

export default function Landing() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="landing-screen">
      <View style={styles.shapeYellow} />
      <View style={styles.shapeBlue} />

      <View style={styles.hero}>
        <Pill bg={COLORS.yellow} style={{ marginBottom: 16 }}>
          <Text style={styles.pillText}>FLICK · GO LIVE · GO GLOBAL</Text>
        </Pill>
        <Text style={styles.title} testID="landing-title">MEET{"\n"}YOUR{"\n"}VIBE.</Text>
        <Text style={styles.sub}>
          Random video chat + Tinder-style discovery. AI keeps it safe, translation keeps it global.
        </Text>

        <View style={[styles.photoStack]}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80" }} style={[styles.photo, { transform: [{ rotate: "-6deg" }], top: 0, left: 8 }]} />
          <Image source={{ uri: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80" }} style={[styles.photo, { transform: [{ rotate: "5deg" }], top: 12, left: 100 }]} />
          <Image source={{ uri: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80" }} style={[styles.photo, { transform: [{ rotate: "-3deg" }], top: 30, left: 200 }]} />
        </View>
      </View>

      <View style={styles.actions}>
        <NeoButton testID="landing-get-started" label="GET STARTED →" onPress={() => router.push("/register")} fullWidth />
        <NeoButton testID="landing-login" label="I HAVE AN ACCOUNT" variant="secondary" onPress={() => router.push("/login")} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgPurple, paddingHorizontal: SPACING.lg },
  shapeYellow: { position: "absolute", width: 140, height: 140, borderRadius: 999, backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.border, top: -40, right: -30 },
  shapeBlue: { position: "absolute", width: 90, height: 90, backgroundColor: COLORS.pink, borderWidth: 3, borderColor: COLORS.border, transform: [{ rotate: "20deg" }], bottom: 160, left: -20 },
  hero: { flex: 1, justifyContent: "center" },
  pillText: { fontWeight: "900", fontSize: 11, color: COLORS.text, letterSpacing: 1.5 },
  title: { ...FONTS.h1, fontSize: 72, lineHeight: 70, color: COLORS.text, marginBottom: SPACING.md, fontWeight: "900" },
  sub: { ...FONTS.bodyLg, color: COLORS.text, marginBottom: SPACING.xl },
  photoStack: { height: 200, marginTop: SPACING.lg },
  photo: { position: "absolute", width: 120, height: 160, borderRadius: RADIUS.lg, borderWidth: 3, borderColor: COLORS.border, ...SHADOW.hard, backgroundColor: COLORS.white },
  actions: { gap: SPACING.md, paddingBottom: SPACING.lg },
});
