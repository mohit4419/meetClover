import { useRouter, Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { NeoButton, NeoInput } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { startEmergentGoogleSignIn } from "@/src/google-auth";
import { COLORS, FONTS, SPACING } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("ava@flick.app");
  const [password, setPassword] = useState("Demo@1234");
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (!email || !password) return toast.show("Fill all fields", "danger");
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/");
    } catch (e: any) {
      toast.show(e.message || "Login failed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>WELCOME{"\n"}BACK.</Text>
          <Text style={styles.sub}>Log in to keep flicking.</Text>

          <View style={{ gap: SPACING.md }}>
            <NeoInput testID="login-email" label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <NeoInput testID="login-password" label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          </View>

          <View style={{ gap: SPACING.md, marginTop: SPACING.xl }}>
            <NeoButton testID="login-submit-button" label={busy ? "LOGGING IN…" : "LOG IN"} onPress={onLogin} disabled={busy} fullWidth />
            <NeoButton testID="login-google-btn" label="CONTINUE WITH GOOGLE" variant="yellow" onPress={() => startEmergentGoogleSignIn()} fullWidth />
            <Link href="/register" asChild>
              <NeoButton testID="login-go-register" label="CREATE ACCOUNT" variant="secondary" fullWidth />
            </Link>
          </View>
          <Text style={styles.demo}>Demo: ava@flick.app / Demo@1234</Text>
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
  demo: { marginTop: SPACING.lg, color: COLORS.textSecondary, fontWeight: "700", textAlign: "center" },
});
