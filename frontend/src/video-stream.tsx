/**
 * Native WebRTC video stream renderer using react-native-webrtc's RTCView.
 * Loaded only on iOS/Android (web has a separate .web.tsx implementation).
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  stream: any | null;
  mirror?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export default function VideoStream({ stream, mirror, testID, style }: Props) {
  if (!stream) return <View testID={testID} style={[styles.container, style]} />;

  let RTCView: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTCView = require("react-native-webrtc").RTCView;
  } catch {
    return <View testID={testID} style={[styles.container, style]} />;
  }
  return (
    <RTCView
      testID={testID}
      streamURL={stream.toURL ? stream.toURL() : ""}
      style={[styles.container, style]}
      objectFit="cover"
      mirror={!!mirror}
    />
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#000" },
});
