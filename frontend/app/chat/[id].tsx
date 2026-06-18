/**
 * 1:1 Chat — text + image + voice with AI moderation and translation.
 */

import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Msg = {
  id: string;
  match_id: string;
  sender_id: string;
  type?: "text" | "image" | "voice";
  text: string;
  image_base64?: string | null;
  voice_base64?: string | null;
  voice_duration_ms?: number | null;
  translated?: { translated_text: string; detected_language: string } | null;
  created_at: string;
};

export default function ChatDetail() {
  const { id, name, photo, lang } = useLocalSearchParams<{ id: string; name: string; photo: string; lang?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recStartRef = useRef<number>(0);
  const listRef = useRef<FlatList<Msg>>(null);

  const targetLang = (lang as string) || "en";

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Msg[] }>(`/chat/${id}/messages`);
      setMessages(r.items);
      await api("/chat/read", { method: "POST", body: { match_id: id } }).catch(() => {});
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const sendBody = async (body: any, optimistic: Partial<Msg>) => {
    setSending(true);
    try {
      const r = await api<{ ok: boolean; blocked?: boolean; message?: Msg; moderation: any }>(
        "/chat/send",
        { method: "POST", body },
      );
      if (!r.ok && r.blocked) {
        toast.show(`Blocked by AI: ${r.moderation?.reason || "violates policy"}`, "danger");
      } else if (r.message) {
        setMessages((m) => [...m, r.message!]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    if (!text.trim() || sending) return;
    const txt = text.trim();
    setText("");
    await sendBody(
      { match_id: id, text: txt, translate_to: translate ? targetLang : null },
      { type: "text", text: txt },
    );
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show("Photo permission denied", "danger");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const dataUri = `data:image/jpeg;base64,${res.assets[0].base64}`;
    await sendBody({ match_id: id, image_base64: dataUri }, { type: "image", image_base64: dataUri });
  };

  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) return toast.show("Mic permission denied", "danger");
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStartRef.current = Date.now();
      setRecording(true);
    } catch (e: any) {
      toast.show(e.message || "Recording failed", "danger");
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) return;
      const duration_ms = Date.now() - recStartRef.current;
      // Read file as base64
      let base64: string | null = null;
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        base64 = await new Promise<string>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.readAsDataURL(blob);
        });
      } else {
        const FS = await import("expo-file-system");
        const b = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
        base64 = `data:audio/m4a;base64,${b}`;
      }
      await sendBody({ match_id: id, voice_base64: base64, voice_duration_ms: duration_ms }, { type: "voice", voice_duration_ms: duration_ms });
    } catch (e: any) {
      toast.show(e.message || "Recording failed", "danger");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="chat-detail-screen">
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <Image source={{ uri: (photo as string) || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200" }} style={styles.avatar} />
        <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        <Pressable
          testID="chat-translate-toggle"
          onPress={() => setTranslate((v) => !v)}
          style={[styles.transBtn, translate && { backgroundColor: COLORS.yellow }]}
        >
          <Ionicons name="language" size={16} color={COLORS.text} />
          <Text style={styles.transBtnText}>{translate ? `→ ${targetLang.toUpperCase()}` : "TRANSLATE"}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.pink} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <MessageBubble item={item} mine={item.sender_id === user?.id} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}><Text style={styles.emptyText}>Say hi to {name} 👋</Text></View>
            }
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable testID="chat-image-btn" onPress={sendImage} style={[styles.miniBtn, SHADOW.hard]}>
            <Ionicons name="image" size={20} color={COLORS.text} />
          </Pressable>
          <Pressable
            testID="chat-voice-btn"
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.miniBtn, SHADOW.hard, recording && { backgroundColor: COLORS.danger }]}
          >
            <Ionicons name={recording ? "stop" : "mic"} size={20} color={recording ? COLORS.white : COLORS.text} />
          </Pressable>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
            maxLength={500}
          />
          <Pressable testID="chat-send-btn" disabled={!text.trim() || sending} onPress={sendText} style={[styles.sendBtn, SHADOW.hard, !text.trim() && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator color={COLORS.text} /> : <Ionicons name="send" size={20} color={COLORS.text} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ item, mine }: { item: Msg; mine: boolean }) {
  const t = item.type || "text";
  return (
    <View testID={`message-${item.id}`} style={[bubble.row, mine ? { justifyContent: "flex-end" } : null]}>
      <View style={[bubble.b, mine ? bubble.mine : bubble.theirs, SHADOW.hard]}>
        {t === "image" && item.image_base64 ? (
          <Image source={{ uri: item.image_base64 }} style={bubble.image} />
        ) : t === "voice" && item.voice_base64 ? (
          <VoiceBubble uri={item.voice_base64} ms={item.voice_duration_ms || 0} mine={mine} />
        ) : (
          <>
            <Text style={[bubble.text, mine && { color: COLORS.text }]}>{item.text}</Text>
            {item.translated?.translated_text && item.translated.translated_text !== item.text ? (
              <Text style={bubble.translated}>↳ {item.translated.translated_text}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function VoiceBubble({ uri, ms, mine }: { uri: string; ms: number; mine: boolean }) {
  const player = useAudioPlayer({ uri });
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (playing) { player.pause(); setPlaying(false); }
    else { player.play(); setPlaying(true); }
  };
  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", (s: any) => {
      if (s?.didJustFinish) setPlaying(false);
    });
    return () => sub.remove();
  }, [player]);
  const secs = Math.max(1, Math.round(ms / 1000));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable testID="voice-play-btn" onPress={toggle} style={[bubble.playBtn, { backgroundColor: mine ? COLORS.white : COLORS.pink }]}>
        <Ionicons name={playing ? "pause" : "play"} size={16} color={COLORS.text} />
      </Pressable>
      <View style={bubble.waveform}>
        {[...Array(14)].map((_, i) => <View key={i} style={[bubble.bar, { height: 6 + ((i * 7) % 16) }]} />)}
      </View>
      <Text style={bubble.duration}>{secs}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 3, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatar: { width: 38, height: 38, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border },
  headerName: { flex: 1, fontWeight: "900", fontSize: 17, color: COLORS.text },
  transBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  transBtnText: { fontWeight: "900", fontSize: 11 },
  list: { padding: SPACING.md, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 3, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  input: { flex: 1, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 15, fontWeight: "600", color: COLORS.text, maxHeight: 120 },
  sendBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 3, borderColor: COLORS.border, backgroundColor: COLORS.yellow, alignItems: "center", justifyContent: "center" },
  miniBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  empty: { padding: SPACING.xl, alignItems: "center" },
  emptyText: { ...FONTS.bodyLg, color: COLORS.textSecondary },
});

const bubble = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4 },
  b: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border },
  mine: { backgroundColor: COLORS.pink, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  text: { color: COLORS.text, fontWeight: "600", fontSize: 15 },
  translated: { marginTop: 4, fontStyle: "italic", color: COLORS.textSecondary, fontWeight: "600", fontSize: 13 },
  image: { width: 220, height: 220, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border },
  playBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  waveform: { flexDirection: "row", gap: 2, alignItems: "center" },
  bar: { width: 3, backgroundColor: COLORS.text, borderRadius: 2 },
  duration: { fontWeight: "800", fontSize: 12, color: COLORS.text },
});
