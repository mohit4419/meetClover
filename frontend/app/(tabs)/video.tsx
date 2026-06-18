/**
 * Live (random video) tab — lobby with start/cancel queue and demo "connected" screen.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { NeoButton, NeoInput, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Phase = "idle" | "searching" | "connected";

export default function VideoLobby() {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [peer, setPeer] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [moderation, setModeration] = useState<{ allowed: boolean; reason: string; severity: string } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [translated, setTranslated] = useState("");
  const [target, setTarget] = useState("es");
  const pulse = useRef(new Animated.Value(1)).current;
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (phase === "searching") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [phase, pulse]);

  const tryMatch = async () => {
    const r = await api<{ matched: boolean; session_id: string | null; peer: User | null }>("/video/start", {
      method: "POST",
      body: {},
    });
    if (r.matched && r.peer) {
      setPeer(r.peer);
      setSessionId(r.session_id);
      setPhase("connected");
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  const start = async () => {
    setPhase("searching");
    setPeer(null);
    try {
      await tryMatch();
      pollRef.current = setInterval(() => { tryMatch().catch(() => {}); }, 2500);
    } catch (e: any) {
      setPhase("idle");
      toast.show(e.message || "Failed", "danger");
    }
  };

  const cancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await api("/video/cancel", { method: "POST" }).catch(() => {});
    setPhase("idle");
    setPeer(null);
    setSessionId(null);
  };

  const end = async () => {
    if (sessionId) await api("/video/end", { method: "POST", body: { session_id: sessionId } }).catch(() => {});
    setPhase("idle");
    setPeer(null);
    setSessionId(null);
    setModeration(null);
    setTranscript(""); setTranslated("");
  };

  const runDemoModeration = async () => {
    if (!transcript.trim()) return toast.show("Type something first", "info");
    const r = await api<{ allowed: boolean; reason: string; severity: string }>("/ai/moderate", {
      method: "POST", body: { text: transcript },
    });
    setModeration(r);
    toast.show(r.allowed ? "Safe ✓" : `Blocked: ${r.reason}`, r.allowed ? "success" : "danger");
  };

  const runTranslate = async () => {
    if (!transcript.trim()) return;
    const r = await api<{ translated_text: string }>("/ai/translate", {
      method: "POST", body: { text: transcript, target_language: target },
    });
    setTranslated(r.translated_text);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (phase === "connected" && peer) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="video-call-screen">
        <View style={styles.callRoot}>
          <Image source={{ uri: peer.photos?.[0] || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800" }} style={styles.remoteVideo} />
          <View style={styles.remoteOverlay} />

          {/* moderation banner */}
          {moderation && !moderation.allowed ? (
            <View testID="moderation-banner" style={[styles.modBanner, SHADOW.hard]}>
              <Ionicons name="warning" size={16} color={COLORS.white} />
              <Text style={styles.modBannerText} numberOfLines={2}>AI FLAG: {moderation.reason}</Text>
            </View>
          ) : null}

          {/* peer info pill */}
          <View style={styles.peerInfo}>
            <Pill bg={COLORS.danger}><Text style={{ fontWeight: "900", fontSize: 11, color: COLORS.white }}>● LIVE</Text></Pill>
            <View style={{ height: 6 }} />
            <Pill bg={COLORS.yellow}><Text style={{ fontWeight: "900", fontSize: 12 }}>{peer.display_name} · {peer.country}</Text></Pill>
          </View>

          {/* local cam mini */}
          <View style={[styles.localCam, SHADOW.hard]}>
            <View style={styles.localCamInner}><Ionicons name="person" size={28} color={COLORS.text} /></View>
          </View>

          {/* live translation panel */}
          <View style={[styles.subtitleBox, SHADOW.hard]}>
            <Text style={styles.subLabel}>LIVE TRANSCRIPT (DEMO)</Text>
            <NeoInput testID="live-transcript-input" placeholder="Type what you'd say…" value={transcript} onChangeText={setTranscript} multiline style={{ minHeight: 40, textAlignVertical: "top" }} />
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {["es", "fr", "ja", "ar", "hi"].map((c) => (
                <Pressable key={c} testID={`tr-target-${c}`} onPress={() => setTarget(c)} style={[styles.targetChip, target === c && { backgroundColor: COLORS.pink }]}>
                  <Text style={styles.targetChipText}>{c.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Pressable testID="moderate-btn" onPress={runDemoModeration} style={[styles.smallBtn, SHADOW.hard, { backgroundColor: COLORS.danger }]}>
                <Text style={[styles.smallBtnText, { color: COLORS.white }]}>MODERATE</Text>
              </Pressable>
              <Pressable testID="translate-btn" onPress={runTranslate} style={[styles.smallBtn, SHADOW.hard, { backgroundColor: COLORS.blue }]}>
                <Text style={styles.smallBtnText}>TRANSLATE</Text>
              </Pressable>
            </View>
            {translated ? <Text testID="translated-text" style={styles.translatedText}>↳ {translated}</Text> : null}
          </View>

          {/* call controls */}
          <View style={styles.callControls}>
            <ControlBtn testID="call-next-btn" icon="play-skip-forward" bg={COLORS.yellow} onPress={() => { end(); start(); }} />
            <ControlBtn testID="call-end-btn" icon="close" bg={COLORS.danger} large onPress={end} />
            <ControlBtn testID="call-report-btn" icon="flag" bg={COLORS.white} onPress={() => toast.show("Report submitted", "success")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="video-lobby-screen">
      <View style={styles.lobby}>
        <Text style={styles.title}>GO LIVE.</Text>
        <Text style={styles.sub}>One tap to meet someone new. AI moderation always on.</Text>

        <View style={styles.lobbyCard}>
          <Animated.View style={[styles.pulse, { transform: [{ scale: pulse }] }]}>
            <Pressable
              testID="go-live-btn"
              disabled={phase === "searching"}
              onPress={phase === "searching" ? cancel : start}
              style={[styles.bigCircle, SHADOW.hardLg, phase === "searching" && { backgroundColor: COLORS.yellow }]}
            >
              {phase === "searching" ? (
                <>
                  <ActivityIndicator size="large" color={COLORS.text} />
                  <Text style={styles.bigCircleText}>SEARCHING…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="videocam" size={56} color={COLORS.text} />
                  <Text style={styles.bigCircleText}>START</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {phase === "searching" ? (
            <NeoButton testID="cancel-search-btn" label="CANCEL" variant="secondary" onPress={cancel} style={{ marginTop: SPACING.lg }} fullWidth />
          ) : null}
        </View>

        <View style={[styles.safetyBox, SHADOW.hard]}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.text} />
          <Text style={styles.safetyText}>
            We screen audio, video and chat with AI. Be kind, be real, be safe.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ControlBtn({ icon, bg, onPress, large, testID }: { icon: any; bg: string; onPress: () => void; large?: boolean; testID?: string }) {
  const size = large ? 72 : 56;
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.controlBtn, SHADOW.hard, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={icon} size={large ? 30 : 22} color={icon === "close" ? COLORS.white : COLORS.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  lobby: { flex: 1, padding: SPACING.lg, gap: SPACING.lg },
  title: { ...FONTS.h1, color: COLORS.text },
  sub: { ...FONTS.bodyLg, color: COLORS.textSecondary },
  lobbyCard: { alignItems: "center", padding: SPACING.lg },
  pulse: { alignItems: "center", justifyContent: "center" },
  bigCircle: { width: 220, height: 220, borderRadius: 110, backgroundColor: COLORS.pink, borderWidth: 4, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", gap: 6 },
  bigCircleText: { fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  safetyBox: { flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.bgSecondary, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center" },
  safetyText: { flex: 1, fontWeight: "700", color: COLORS.text, fontSize: 13 },
  // call
  callRoot: { flex: 1, backgroundColor: COLORS.text, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, margin: SPACING.md, overflow: "hidden" },
  remoteVideo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  remoteOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)" },
  peerInfo: { position: "absolute", top: 14, left: 14 },
  localCam: { position: "absolute", top: 14, right: 14, width: 100, height: 130, borderRadius: 12, borderWidth: 3, borderColor: COLORS.border, backgroundColor: COLORS.bgSecondary, overflow: "hidden" },
  localCamInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  modBanner: { position: "absolute", top: 70, alignSelf: "center", backgroundColor: COLORS.danger, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", gap: 6, alignItems: "center", maxWidth: "82%" },
  modBannerText: { color: COLORS.white, fontWeight: "900", fontSize: 12, letterSpacing: 0.5 },
  subtitleBox: { position: "absolute", left: 12, right: 12, bottom: 110, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4 },
  subLabel: { ...FONTS.label, color: COLORS.text },
  targetChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.white },
  targetChipText: { fontWeight: "900", fontSize: 11 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border },
  smallBtnText: { fontWeight: "900", fontSize: 12, letterSpacing: 0.5 },
  translatedText: { marginTop: 6, fontWeight: "700", color: COLORS.text, fontSize: 13 },
  callControls: { position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: SPACING.md, alignItems: "center" },
  controlBtn: { borderWidth: 3, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
});
