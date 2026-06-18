/**
 * Web video stream renderer — uses a native HTML <video> element via createElement,
 * which Expo Web passes through to the DOM.
 */

import React, { useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type Props = {
  stream: MediaStream | null;
  mirror?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function VideoStream({ stream, mirror, testID, style }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream as any;
    }
  }, [stream]);

  const flat = Array.isArray(style) ? Object.assign({}, ...(style as any[])) : (style as any) || {};
  const cssStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: mirror ? "scaleX(-1)" : undefined,
    backgroundColor: "#000",
    display: "block",
    ...flat,
  };

  return React.createElement("video", {
    ref,
    "data-testid": testID,
    autoPlay: true,
    playsInline: true,
    muted: !!mirror, // local preview is muted to avoid echo
    style: cssStyle,
  });
}
