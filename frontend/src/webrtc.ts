/**
 * Web-only WebRTC helpers — uses browser APIs.
 * Metro picks this on web; the .native.ts variant is used on iOS/Android.
 */

export type RTC = {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: any;
  available: boolean;
};

export function getRTC(): RTC {
  const w = typeof window !== "undefined" ? (window as any) : {};
  return {
    RTCPeerConnection: w.RTCPeerConnection,
    RTCSessionDescription: w.RTCSessionDescription,
    RTCIceCandidate: w.RTCIceCandidate,
    mediaDevices: typeof navigator !== "undefined" ? navigator.mediaDevices : null,
    available: !!w.RTCPeerConnection && !!w.RTCSessionDescription,
  };
}

export function backendWsUrl(): string {
  const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  return base.replace(/^http/, "ws") + "/api/ws/signal";
}
