/**
 * Google sign-in helper. Opens Emergent auth page; on the web we use a full-page
 * redirect so the auth provider can append the session_id fragment to the URL.
 */

import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

const EMERGENT_AUTH_URL = "https://auth.emergentagent.com/";

export async function startEmergentGoogleSignIn() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const redirect = `${window.location.origin}/auth/google`;
    window.location.href = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirect)}`;
    return;
  }
  // Native: open in-app browser; result returns when browser is closed.
  const redirect = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/auth/google";
  await WebBrowser.openBrowserAsync(`${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirect)}`);
}
