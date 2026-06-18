/**
 * 1:1 Chat — text messages with AI moderation and optional translation.
 */

import { Ionicons } from "@expo/vector-icons";
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
  text: string;
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
  const listRef = useRef<FlatList<Msg>>(null);

  const targetLang = (lang as string) || "en";

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Msg[] }>(`/chat/${id}/messages`);
      setMessages(r.items);
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const r = await api<{ ok: boolean; blocked?: boolean; message?: Msg; moderation: any }>(
        "/chat/send",
        { method: "POST", body: { match_id: id, text: text.trim(), translate_to: translate ? targetLang : null } },
      );
      if (!r.ok && r.blocked) {
        toast.show(`Blocked by AI: ${r.moderation?.reason || "violates policy"}`, "danger");
      } else if (r.message) {
        setMessages((m) => [...m, r.message!]);
        setText("");
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View testID={`message-${item.id}`} style={[styles.msgRow, mine ? { justifyContent: "flex-end" } : null]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, SHADOW.hard]}>
          <Text style={[styles.bubbleText, mine && { color: COLORS.text }]}>{item.text}</Text>
          {item.translated?.translated_text && item.translated.translated_text !== item.text ? (
            <Text style={styles.translated}>↳ {item.translated.translated_text}</Text>
          ) : null}
        </View>
      </View>
    );
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

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.pink} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}><Text style={styles.emptyText}>Say hi to {name} 👋</Text></View>
            }
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          <Pressable testID="chat-send-btn" disabled={!text.trim() || sending} onPress={send} style={[styles.sendBtn, SHADOW.hard, !text.trim() && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator color={COLORS.text} /> : <Ionicons name="send" size={20} color={COLORS.text} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  msgRow: { flexDirection: "row", marginVertical: 4 },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.border },
  bubbleMine: { backgroundColor: COLORS.pink, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  bubbleText: { color: COLORS.text, fontWeight: "600", fontSize: 15 },
  translated: { marginTop: 4, fontStyle: "italic", color: COLORS.textSecondary, fontWeight: "600", fontSize: 13 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 3, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  input: { flex: 1, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 15, fontWeight: "600", color: COLORS.text, maxHeight: 120 },
  sendBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 3, borderColor: COLORS.border, backgroundColor: COLORS.yellow, alignItems: "center", justifyContent: "center" },
  empty: { padding: SPACING.xl, alignItems: "center" },
  emptyText: { ...FONTS.bodyLg, color: COLORS.textSecondary },
});
