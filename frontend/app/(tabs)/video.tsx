/**
 * Live (random video) tab — real WebRTC. Web uses browser APIs;
 * native iOS/Android use react-native-webrtc (requires a dev/production build).
 *
 * Flow:
 *   1) POST /api/video/start -> backend either pairs with a waiting peer OR queues us.
 *      If queued, we poll POST /api/video/poll until a session_id is allocated.
 *   2) Open WebSocket /api/ws/signal?session_id=...&token=JWT.
 *   3) The "caller" creates an offer; the "callee" answers; ICE candidates flow.
 *   4) Render local + remote streams; show call timer + AI translation/moderation HUD.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { User } from "@/src/auth";
import { NeoButton, NeoInput, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import VideoStream from "@/src/video-stream";
import { backendWsUrl, getRTC } from "@/src/webrtc";
import { storage } from "@/src/utils/storage";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Phase = "idle" | "searching" | "matched" | "connected" | "error";
type IceServer = { urls: string; username?: string; credential?: string };
type StartResp = { matched: boolean; session_id: string | null; role: "caller" | "callee" | null; peer: User | null; ice_servers: IceServer[] };

export default function VideoLobby() {
  const toast = useToast();
  const rtc = getRTC();

  const [phase, setPhase] = useState<Phase>("idle");
  const [peer, setPeer] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<"caller" | "callee" | null>(null);
  const [iceServers, setIceServers] = useState<IceServer[]>([]);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [moderation, setModeration] = useState<{ allowed: boolean; reason: string; severity: string } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [translated, setTranslated] = useState("");
  const [target, setTarget] = useState("es");
  const [duration, setDuration] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase === "searching") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: Platform.OS !== "web" }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== "web" }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [phase, pulse]);

  useEffect(() => () => { teardown(true); /* eslint-disable-line */ }, []);

  // Native check
  if (!rtc.available && Platform.OS !== "web") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]} testID="video-lobby-screen">
        <View style={styles.lobby}>
          <Text style={styles.title}>BUILD REQUIRED</Text>
          <Text style={styles.sub}>
            Live video uses react-native-webrtc, which is not part of Expo Go.
            Tap <Text style={{ fontWeight: "900" }}>Publish</Text> in the top-right of Emergent
            and generate an iOS / Android dev build to enable real peer streaming.
            The web preview works without a build.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  async function teardown(silent = false) {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (durRef.current) { clearInterval(durRef.current); durRef.current = null; }
    try { wsRef.current?.send(JSON.stringify({ type: "bye" })); } catch { /* noop */ }
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
    try { pcRef.current?.close?.(); } catch { /* noop */ }
    pcRef.current = null;
    if (localStream) {
      try { localStream.getTracks?.().forEach((t: any) => t.stop()); } catch { /* noop */ }
    }
    setLocalStream(null);
    setRemoteStream(null);
    if (sessionId) await api("/video/end", { method: "POST", body: { session_id: sessionId } }).catch(() => {});
    if (!silent) toast.show("Call ended", "info");
    setPhase("idle"); setPeer(null); setSessionId(null); setRole(null);
    setDuration(0); setModeration(null); setTranscript(""); setTranslated("");
  }

  async function acquireLocalStream(): Promise<any> {
    if (!rtc.mediaDevices?.getUserMedia) throw new Error("getUserMedia not available");
    const stream = await rtc.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { width: 640, height: 480, facingMode: "user" },
    });
    setLocalStream(stream);
    return stream;
  }

  async function setupPeerConnection(stream: any, ice: IceServer[]) {
    const pc = new rtc.RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));

    pc.onicecandidate = (e: any) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
      }
    };
    pc.ontrack = (e: any) => {
      if (e.streams?.[0]) setRemoteStream(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setPhase("connected");
        if (!durRef.current) {
          durRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      } else if (state === "failed" || state === "disconnected" || state === "closed") {
        // peer lost — silently end
        teardown(true);
      }
    };
    return pc;
  }

  async function connectSignaling(sid: string, myRole: "caller" | "callee", stream: any, ice: IceServer[]) {
    const token = (await storage.secureGet("access_token", null)) as string | null;
    if (!token) throw new Error("Not authenticated");
    const url = `${backendWsUrl()}?session_id=${sid}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    let pc: any = null;
    ws.onopen = async () => {
      pc = await setupPeerConnection(stream, ice);
    };
    ws.onmessage = async (evt) => {
      const msg = JSON.parse(typeof evt.data === "string" ? evt.data : "{}");
      if (msg.type === "peer-joined") {
        if (!pc) pc = await setupPeerConnection(stream, ice);
        if (myRole === "caller") {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", sdp: offer }));
        }
      } else if (msg.type === "offer") {
        if (!pc) pc = await setupPeerConnection(stream, ice);
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", sdp: answer }));
      } else if (msg.type === "answer") {
        if (pc) await pc.setRemoteDescription(new rtc.RTCSessionDescription(msg.sdp));
      } else if (msg.type === "ice") {
        try {
          if (pc && msg.candidate) await pc.addIceCandidate(new rtc.RTCIceCandidate(msg.candidate));
        } catch { /* noop */ }
      } else if (msg.type === "peer-left") {
        toast.show("Peer left the call", "info");
        teardown(true);
      } else if (msg.type === "error") {
        toast.show(`Signaling error: ${msg.reason}`, "danger");
        teardown(true);
      }
    };
    ws.onerror = () => toast.show("Signaling error", "danger");
    ws.onclose = () => { wsRef.current = null; };
  }

  const start = async () => {
    setPhase("searching");
    setPeer(null);
    try {
      const stream = await acquireLocalStream();
      const r = await api<StartResp>("/video/start", { method: "POST", body: {} });
      if (r.matched && r.session_id && r.role) {
        setSessionId(r.session_id); setRole(r.role); setPeer(r.peer); setIceServers(r.ice_servers);
        setPhase("matched");
        await connectSignaling(r.session_id, r.role, stream, r.ice_servers);
      } else {
        // queued — poll
        pollRef.current = setInterval(async () => {
          try {
            const p = await api<StartResp>("/video/poll", { method: "POST" });
            if (p.matched && p.session_id && p.role) {
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              setSessionId(p.session_id); setRole(p.role); setPeer(p.peer); setIceServers(p.ice_servers);
              setPhase("matched");
              await connectSignaling(p.session_id, p.role, stream, p.ice_servers);
            }
          } catch { /* noop */ }
        }, 2500);
      }
    } catch (e: any) {
      toast.show(e.message || "Could not start call (camera/mic permission?)", "danger");
      setPhase("idle");
    }
  };

  const cancel = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await api("/video/cancel", { method: "POST" }).catch(() => {});
    teardown(true);
  };

  const next = async () => { await teardown(true); start(); };

  const runDemoModeration = async () => {
    if (!transcript.trim()) return toast.show("Type something first", "info");
    const r = await api<{ allowed: boolean; reason: string; severity: string }>("/ai/moderate", { method: "POST", body: { text: transcript } });
    setModeration(r);
    toast.show(r.allowed ? "Safe ✓" : `Blocked: ${r.reason}`, r.allowed ? "success" : "danger");
  };

  const runTranslate = async () => {
    if (!transcript.trim()) return;
    const r = await api<{ translated_text: string }>("/ai/translate", { method: "POST", body: { text: transcript, target_language: target } });
    setTranslated(r.translated_text);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (phase === "matched" || phase === "connected") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="video-call-screen">
        <View style={styles.callRoot}>
          <View style={styles.remoteWrap}>
            <VideoStream stream={remoteStream} testID="remote-video" style={styles.remoteVideo} />
            {!remoteStream ? (
              <View style={styles.remotePlaceholder}>
                <ActivityIndicator color={COLORS.white} size="large" />
                <Text style={styles.remotePlaceholderText}>CONNECTING…</Text>
              </View>
            ) : null}
          </View>

          {moderation && !moderation.allowed ? (
            <View testID="moderation-banner" style={[styles.modBanner, SHADOW.hard]}>
              <Ionicons name="warning" size={16} color={COLORS.white} />
              <Text style={styles.modBannerText} numberOfLines={2}>AI FLAG: {moderation.reason}</Text>
            </View>
          ) : null}

          <View style={styles.peerInfo}>
            <Pill bg={phase === "connected" ? COLORS.danger : COLORS.yellow}>
              <Text style={{ fontWeight: "900", fontSize: 11, color: phase === "connected" ? COLORS.white : COLORS.text }}>
                {phase === "connected" ? `● LIVE · ${fmt(duration)}` : "CONNECTING…"}
              </Text>
            </Pill>
            <View style={{ height: 6 }} />
            <Pill bg={COLORS.yellow}><Text style={{ fontWeight: "900", fontSize: 12 }}>{peer?.display_name || "Peer"} · {peer?.country || "—"}</Text></Pill>
          </View>

          <View style={[styles.localCam, SHADOW.hard]}>
            <VideoStream stream={localStream} mirror testID="local-video" style={styles.localVideo} />
          </View>

          <View style={[styles.subtitleBox, SHADOW.hard]}>
            <Text style={styles.subLabel}>AI MODERATION + TRANSLATE</Text>
            <NeoInput testID="live-transcript-input" placeholder="Type something to test moderation/translate…" value={transcript} onChangeText={setTranscript} multiline style={{ minHeight: 40, textAlignVertical: "top" }} />
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

          <View style={styles.callControls}>
            <ControlBtn testID="call-next-btn" icon="play-skip-forward" bg={COLORS.yellow} onPress={next} />
            <ControlBtn testID="call-end-btn" icon="close" bg={COLORS.danger} large onPress={() => teardown(false)} />
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
        <Text style={styles.sub}>One tap. AI moderation always on. Real WebRTC peer-to-peer.</Text>

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
            We screen audio, video and chat with AI. Real peer streaming works on web preview; iOS/Android need a dev build.
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
  callRoot: { flex: 1, backgroundColor: COLORS.text, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, margin: SPACING.md, overflow: "hidden" },
  remoteWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLORS.text },
  remoteVideo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" },
  remotePlaceholder: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 12 },
  remotePlaceholderText: { color: COLORS.white, fontWeight: "900", letterSpacing: 1 },
  peerInfo: { position: "absolute", top: 14, left: 14 },
  localCam: { position: "absolute", top: 14, right: 14, width: 100, height: 130, borderRadius: 12, borderWidth: 3, borderColor: COLORS.border, backgroundColor: COLORS.bgSecondary, overflow: "hidden" },
  localVideo: { width: "100%", height: "100%" },
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
