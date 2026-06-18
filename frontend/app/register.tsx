import { useRouter, Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { NeoButton, NeoInput } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, SPACING } from "@/src/theme";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) return toast.show("Fill all fields", "danger");
    if (password.length < 6) return toast.show("Password 6+ chars", "danger");
    setBusy(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      router.replace("/onboarding");
    } catch (e: any) {
      toast.show(e.message || "Registration failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>JOIN{"\n"}THE FLICK.</Text>
          <Text style={styles.sub}>30 seconds. Real people. Real fun.</Text>
          <View style={{ gap: SPACING.md }}>
            <NeoInput testID="register-name" label="DISPLAY NAME" value={name} onChangeText={setName} />
            <NeoInput testID="register-email" label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <NeoInput testID="register-password" label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <View style={{ gap: SPACING.md, marginTop: SPACING.xl }}>
            <NeoButton testID="register-submit-button" label={busy ? "CREATING…" : "CREATE ACCOUNT"} onPress={onSubmit} disabled={busy} fullWidth />
            <Link href="/login" asChild>
              <NeoButton testID="register-go-login" label="I HAVE AN ACCOUNT" variant="secondary" fullWidth />
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: SPACING.xl, flexGrow: 1 },
  title: { ...FONTS.h1, color: COLORS.text, marginBottom: SPACING.sm },
  sub: { ...FONTS.bodyLg, color: COLORS.textSecondary, marginBottom: SPACING.xl },
});
