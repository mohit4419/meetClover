/**
 * Google OAuth callback — captures session_id from URL fragment, logs the user in.
 */

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { NeoButton } from "@/src/components/ui";
import { useToast } from "@/src/components/toast";
import { COLORS, FONTS, SPACING } from "@/src/theme";

export default function GoogleCallback() {
  const router = useRouter();
  const { loginWithGoogleSession } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        let sessionId: string | null = null;
        if (typeof window !== "undefined") {
          const hash = (window.location.hash || "").replace(/^#/, "");
          const params = new URLSearchParams(hash);
          sessionId = params.get("session_id");
        }
        if (!sessionId) throw new Error("No session_id in URL fragment.");
        await loginWithGoogleSession(sessionId);
        toast.show("Logged in with Google!", "success");
        router.replace("/");
      } catch (e: any) {
        setError(e.message || "Google login failed");
      }
    })();
  }, [loginWithGoogleSession, router, toast]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="google-callback-screen">
      <View style={styles.center}>
        {!error ? (
          <>
            <ActivityIndicator size="large" color={COLORS.pink} />
            <Text style={styles.title}>Finishing sign-in…</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Sign-in failed.</Text>
            <Text style={styles.sub}>{error}</Text>
            <NeoButton testID="gcb-back-login" label="BACK TO LOGIN" onPress={() => router.replace("/login")} style={{ marginTop: SPACING.lg }} fullWidth />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: SPACING.md },
  title: { ...FONTS.h2, color: COLORS.text, textAlign: "center" },
  sub: { ...FONTS.body, color: COLORS.textSecondary, textAlign: "center" },
});
