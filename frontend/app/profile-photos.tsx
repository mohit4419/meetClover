/**
 * Multi-photo gallery — add/remove up to 6 photos.
 * Web fallback uses paste-a-URL because expo-image-picker needs native bridge.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { NeoButton, NeoInput } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

const MAX = 6;

export default function ProfilePhotos() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);

  const addFromGallery = async () => {
    if (photos.length >= MAX) return toast.show("Max 6 photos", "info");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show("Photo permission denied", "danger");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const dataUri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    setPhotos((p) => [...p, dataUri].slice(0, MAX));
  };

  const addFromUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (photos.length >= MAX) return toast.show("Max 6 photos", "info");
    setPhotos((p) => [...p, url]);
    setUrlInput("");
  };

  const remove = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    setPhotos(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      const u = await api<User>("/profile/photos", { method: "PUT", body: { photos } });
      updateUser(u);
      toast.show("Photos saved!", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="photos-screen">
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="photos-back" style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={COLORS.text} /></Pressable>
          <Text style={styles.title}>PHOTOS</Text>
        </View>

        <Text style={styles.sub}>Add up to {MAX} photos. Drag-free reorder with the arrows.</Text>

        <View style={styles.grid}>
          {Array.from({ length: MAX }).map((_, i) => {
            const p = photos[i];
            return (
              <View key={i} style={[styles.slot, SHADOW.hard]} testID={`photo-slot-${i}`}>
                {p ? (
                  <>
                    <Image source={{ uri: p }} style={styles.photo} />
                    <View style={styles.slotControls}>
                      <Pressable testID={`photo-up-${i}`} onPress={() => move(i, -1)} style={styles.miniBtn}><Ionicons name="chevron-up" size={14} color={COLORS.text} /></Pressable>
                      <Pressable testID={`photo-down-${i}`} onPress={() => move(i, 1)} style={styles.miniBtn}><Ionicons name="chevron-down" size={14} color={COLORS.text} /></Pressable>
                    </View>
                    <Pressable testID={`photo-remove-${i}`} onPress={() => remove(i)} style={[styles.removeBtn, SHADOW.hard]}>
                      <Ionicons name="close" size={14} color={COLORS.white} />
                    </Pressable>
                    {i === 0 ? <View style={styles.primaryBadge}><Text style={styles.primaryText}>MAIN</Text></View> : null}
                  </>
                ) : (
                  <Pressable testID={`photo-add-${i}`} onPress={addFromGallery} style={styles.empty}>
                    <Ionicons name="add" size={28} color={COLORS.text} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {Platform.OS !== "web" ? (
          <NeoButton testID="photos-pick-btn" label="PICK FROM GALLERY" variant="yellow" style={{ marginTop: SPACING.md }} onPress={addFromGallery} fullWidth />
        ) : (
          <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
            <NeoInput testID="photos-url-input" label="ADD BY URL (WEB)" value={urlInput} onChangeText={setUrlInput} placeholder="https://..." autoCapitalize="none" />
            <NeoButton testID="photos-url-add-btn" label="ADD PHOTO URL" variant="yellow" onPress={addFromUrl} fullWidth />
          </View>
        )}

        <NeoButton testID="photos-save-btn" label={busy ? "SAVING…" : "SAVE"} onPress={save} disabled={busy} style={{ marginTop: SPACING.lg, marginBottom: SPACING.xl }} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.white },
  title: { ...FONTS.h2, color: COLORS.text },
  sub: { ...FONTS.body, color: COLORS.textSecondary, marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.sm },
  slot: { width: "47%", aspectRatio: 3 / 4, borderWidth: 3, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.white, overflow: "hidden", position: "relative" },
  photo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  slotControls: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", gap: 4 },
  miniBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  removeBtn: { position: "absolute", right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.danger, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  primaryBadge: { position: "absolute", left: 6, top: 6, backgroundColor: COLORS.yellow, borderWidth: 2, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  primaryText: { fontSize: 10, fontWeight: "900", color: COLORS.text },
});
