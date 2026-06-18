/**
 * Entry — redirects depending on auth state.
 */

import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/auth";
import { COLORS } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.pink} size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/landing" />;
  if (!user.gender || !user.country || (user.interests?.length || 0) < 1) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)/swipe" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
});
