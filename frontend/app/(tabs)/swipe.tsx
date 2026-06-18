/**
 * Swipe Deck — Tinder-style with PanResponder.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

const { width: W, height: H } = Dimensions.get("window");
const CARD_W = Math.min(W - 32, 380);
const CARD_H = Math.min(H * 0.62, 560);
const SWIPE_THRESHOLD = 120;

type Action = "like" | "pass" | "super";

export default function SwipeScreen() {
  const router = useRouter();
  const toast = useToast();
  const [profiles, setProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const pos = useRef(new Animated.ValueXY()).current;
  const flash = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: User[] }>("/discover");
      setProfiles(r.items);
    } catch (e: any) {
      toast.show(e.message || "Failed to load", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const current = profiles[0];
  const next = profiles[1];

  const sendSwipe = useCallback(async (target_id: string, action: Action) => {
    try {
      const r = await api<{ ok: boolean; match: any }>("/swipe", {
        method: "POST",
        body: { target_id, action },
      });
      if (r.match) {
        router.push({ pathname: "/match", params: { matchId: r.match.id, otherId: r.match.other_user.id, name: r.match.other_user.display_name, photo: r.match.other_user.photos?.[0] || "" } });
      }
    } catch (e: any) {
      toast.show(e.message || "Swipe failed", "danger");
    }
  }, [router, toast]);

  const completeSwipe = useCallback((action: Action) => {
    if (!current) return;
    const toX = action === "pass" ? -W * 1.5 : W * 1.5;
    const toY = action === "super" ? -H : 0;
    Animated.timing(pos, { toValue: { x: toX, y: toY }, duration: 280, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      setProfiles((p) => p.slice(1));
      sendSwipe(current.id, action);
    });
    if (action === "super") {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [current, pos, flash, sendSwipe]);

  const undo = useCallback(async () => {
    try {
      await api("/swipe/undo", { method: "POST" });
      load();
    } catch {
      toast.show("Nothing to undo", "info");
    }
  }, [load, toast]);

  const panResponder = useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) completeSwipe("like");
        else if (g.dx < -SWIPE_THRESHOLD) completeSwipe("pass");
        else if (g.dy < -SWIPE_THRESHOLD) completeSwipe("super");
        else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    }), [pos, completeSwipe]);

  const rotate = pos.x.interpolate({ inputRange: [-W, 0, W], outputRange: ["-12deg", "0deg", "12deg"] });
  const likeOpacity = pos.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });
  const passOpacity = pos.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const superOpacity = pos.y.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="swipe-screen">
      <View style={styles.header}>
        <Text style={styles.brand}>flick.</Text>
        <Pressable onPress={() => router.push("/subscription")} style={styles.upgradeBtn} testID="swipe-upgrade-btn">
          <Ionicons name="diamond" size={14} color={COLORS.text} />
          <Text style={styles.upgradeText}>UPGRADE</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.pink} /></View>
      ) : !current ? (
        <View style={styles.center}>
          <Text style={styles.empty}>NO MORE PEOPLE.</Text>
          <Text style={styles.emptySub}>Check back later or try Live video.</Text>
          <Pressable testID="swipe-refresh" onPress={load} style={[styles.refresh, SHADOW.hard]}>
            <Text style={styles.refreshText}>REFRESH</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.deck}>
          {next ? <Card user={next} style={[styles.cardBg]} /> : null}
          <Animated.View
            testID="swipe-card"
            style={[
              styles.cardWrap,
              {
                transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Card user={current} />
            <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
              <Text style={[styles.stampText, { color: COLORS.success }]}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}>
              <Text style={[styles.stampText, { color: COLORS.danger }]}>NOPE</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampSuper, { opacity: superOpacity }]}>
              <Text style={[styles.stampText, { color: COLORS.blue }]}>SUPER</Text>
            </Animated.View>
          </Animated.View>
        </View>
      )}

      <View style={styles.actions}>
        <ActionBtn testID="swipe-undo-btn" icon="arrow-undo" bg={COLORS.yellow} size={56} onPress={undo} />
        <ActionBtn testID="swipe-pass-btn" icon="close" bg={COLORS.white} size={72} onPress={() => completeSwipe("pass")} />
        <ActionBtn testID="swipe-super-btn" icon="star" bg={COLORS.blue} size={56} onPress={() => completeSwipe("super")} />
        <ActionBtn testID="swipe-like-btn" icon="heart" bg={COLORS.pink} size={72} onPress={() => completeSwipe("like")} />
      </View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
    </SafeAreaView>
  );
}

function Card({ user, style }: { user: User; style?: any }) {
  return (
    <View style={[styles.card, SHADOW.hardLg, style]}>
      <Image source={{ uri: user.photos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600" }} style={styles.photo} />
      <View style={styles.cardOverlay}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {user.verified ? (
            <Pill bg={COLORS.blue}>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Ionicons name="checkmark" size={12} color={COLORS.text} />
                <Text style={{ fontWeight: "900", fontSize: 11 }}>VERIFIED</Text>
              </View>
            </Pill>
          ) : null}
          <Pill bg={COLORS.yellow}><Text style={{ fontWeight: "900", fontSize: 11 }}>TRUST {user.trust_score}</Text></Pill>
        </View>
        <Text style={styles.cardName}>{user.display_name}{user.age ? `, ${user.age}` : ""}</Text>
        <Text style={styles.cardMeta}>{[user.country, user.languages?.[0]?.toUpperCase()].filter(Boolean).join(" · ")}</Text>
        {user.bio ? <Text style={styles.cardBio} numberOfLines={2}>{user.bio}</Text> : null}
        <View style={styles.interestsRow}>
          {(user.interests || []).slice(0, 4).map((i) => (
            <View key={i} style={styles.interestPill}><Text style={styles.interestText}>{i}</Text></View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ActionBtn({ icon, bg, size, onPress, testID }: { icon: any; bg: string; size: number; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.actionBtn, SHADOW.hard, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={icon} size={size * 0.42} color={COLORS.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  brand: { ...FONTS.h2, color: COLORS.text },
  upgradeBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: COLORS.yellow, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  upgradeText: { fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  deck: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardWrap: { width: CARD_W, height: CARD_H },
  cardBg: { position: "absolute", transform: [{ scale: 0.95 }], opacity: 0.6 },
  card: { width: CARD_W, height: CARD_H, borderRadius: RADIUS.lg, borderWidth: 3, borderColor: COLORS.border, backgroundColor: COLORS.white, overflow: "hidden" },
  photo: { width: "100%", height: "100%", position: "absolute" },
  cardOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.md, backgroundColor: "rgba(255,255,255,0.92)", borderTopWidth: 3, borderTopColor: COLORS.border, gap: 4 },
  cardName: { fontSize: 28, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  cardMeta: { fontSize: 13, fontWeight: "800", color: COLORS.text, letterSpacing: 1 },
  cardBio: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  interestPill: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.bgSecondary, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999 },
  interestText: { fontSize: 11, fontWeight: "800", color: COLORS.text },
  actions: { flexDirection: "row", gap: SPACING.md, justifyContent: "center", alignItems: "center", paddingVertical: SPACING.md },
  actionBtn: { borderWidth: 3, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stamp: { position: "absolute", top: 40, padding: 8, borderWidth: 4, borderRadius: 8, transform: [{ rotate: "-10deg" }] },
  stampLike: { right: 30, borderColor: COLORS.success },
  stampPass: { left: 30, borderColor: COLORS.danger, transform: [{ rotate: "10deg" }] },
  stampSuper: { top: 100, alignSelf: "center", borderColor: COLORS.blue },
  stampText: { fontWeight: "900", fontSize: 32, letterSpacing: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  empty: { ...FONTS.h2, color: COLORS.text },
  emptySub: { ...FONTS.body, color: COLORS.textSecondary, marginTop: 6, textAlign: "center" },
  refresh: { marginTop: 16, backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.border, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  refreshText: { fontWeight: "900" },
  flash: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLORS.yellow },
});
