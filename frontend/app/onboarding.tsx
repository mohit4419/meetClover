/**
 * Onboarding — collect age, gender, country, interests, bio, photo URL.
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { Chip, NeoButton, NeoInput } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, COUNTRIES, FONTS, INTERESTS, LANGUAGES, SPACING } from "@/src/theme";

const GENDERS = ["female", "male", "other"];

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [age, setAge] = useState(String(user?.age || ""));
  const [gender, setGender] = useState(user?.gender || "");
  const [country, setCountry] = useState(user?.country || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [photoUrl, setPhotoUrl] = useState(user?.photos?.[0] || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [languages, setLanguages] = useState<string[]>(user?.languages?.length ? user.languages : ["en"]);
  const [busy, setBusy] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string, max?: number) => {
    if (arr.includes(v)) set(arr.filter((x) => x !== v));
    else if (!max || arr.length < max) set([...arr, v]);
  };

  const onSave = async () => {
    if (!age || !gender || !country || interests.length === 0) {
      return toast.show("Fill required fields", "danger");
    }
    setBusy(true);
    try {
      const updated = await api<User>("/profile", {
        method: "PUT",
        body: {
          age: parseInt(age, 10),
          gender,
          country,
          bio,
          photos: photoUrl ? [photoUrl] : [],
          interests,
          languages,
          preferred_language: languages[0] || "en",
        },
      });
      updateUser(updated);
      toast.show("Profile saved!", "success");
      router.replace("/(tabs)/swipe");
    } catch (e: any) {
      toast.show(e.message || "Save failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="onboarding-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>TELL US{"\n"}ABOUT YOU.</Text>

          <Text style={styles.section}>BASICS</Text>
          <View style={{ gap: SPACING.md }}>
            <NeoInput testID="onb-age" label="AGE" keyboardType="number-pad" value={age} onChangeText={setAge} maxLength={3} />
            <View>
              <Text style={styles.label}>GENDER</Text>
              <View style={styles.row}>
                {GENDERS.map((g) => (
                  <Chip key={g} testID={`onb-gender-${g}`} label={g.toUpperCase()} active={gender === g} onPress={() => setGender(g)} />
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.label}>COUNTRY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {COUNTRIES.map((c) => (
                  <Chip key={c} testID={`onb-country-${c}`} label={c} active={country === c} onPress={() => setCountry(c)} />
                ))}
              </ScrollView>
            </View>
          </View>

          <Text style={styles.section}>INTERESTS ({interests.length}/5)</Text>
          <View style={styles.wrap}>
            {INTERESTS.map((i) => (
              <Chip key={i} testID={`onb-interest-${i}`} label={i} active={interests.includes(i)} onPress={() => toggle(interests, setInterests, i, 5)} />
            ))}
          </View>

          <Text style={styles.section}>LANGUAGES</Text>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip key={l.code} testID={`onb-lang-${l.code}`} label={l.name} active={languages.includes(l.code)} onPress={() => toggle(languages, setLanguages, l.code)} />
            ))}
          </View>

          <Text style={styles.section}>BIO</Text>
          <NeoInput testID="onb-bio" placeholder="Say something fun…" multiline value={bio} onChangeText={setBio} style={{ minHeight: 90, textAlignVertical: "top" }} />

          <Text style={styles.section}>PROFILE PHOTO URL</Text>
          <NeoInput testID="onb-photo" placeholder="https://…" value={photoUrl} onChangeText={setPhotoUrl} autoCapitalize="none" />

          <View style={{ marginTop: SPACING.xl, marginBottom: SPACING.xl }}>
            <NeoButton testID="onb-save-button" label={busy ? "SAVING…" : "SAVE & START"} onPress={onSave} disabled={busy} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg },
  title: { ...FONTS.h1, color: COLORS.text, marginBottom: SPACING.lg },
  section: { ...FONTS.label, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  label: { ...FONTS.label, color: COLORS.text, marginBottom: SPACING.sm },
  row: { flexDirection: "row", gap: SPACING.sm, paddingRight: SPACING.lg },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
