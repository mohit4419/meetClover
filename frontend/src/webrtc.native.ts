/**
 * Native (iOS/Android) WebRTC helpers — uses react-native-webrtc.
 * NOT loaded on web (Metro picks webrtc.ts there).
 * NOT available in Expo Go — requires a dev/production build.
 */

import { Platform } from "react-native";

export type RTC = {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: any;
  available: boolean;
};

let cache: RTC | null = null;

export function getRTC(): RTC {
  if (cache) return cache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wr = require("react-native-webrtc");
    cache = {
      RTCPeerConnection: wr.RTCPeerConnection,
      RTCSessionDescription: wr.RTCSessionDescription,
      RTCIceCandidate: wr.RTCIceCandidate,
      mediaDevices: wr.mediaDevices,
      available: !!wr.RTCPeerConnection,
    };
  } catch {
    cache = {
      RTCPeerConnection: null,
      RTCSessionDescription: null,
      RTCIceCandidate: null,
      mediaDevices: null,
      available: false,
    };
  }
  return cache;
}

export function backendWsUrl(): string {
  const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  const proto = base.startsWith("https") ? "wss" : "ws";
  const stripped = base.replace(/^https?:\/\//, "");
  // On native, use the LAN backend URL passed via env
  return `${proto}://${stripped}/api/ws/signal${Platform.OS ? "" : ""}`;
}
